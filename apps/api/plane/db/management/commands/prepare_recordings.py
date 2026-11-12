import json

from botocore.exceptions import ClientError
from django.core.management.base import BaseCommand, CommandError

from plane.app.views.workspace.recording import recording_storage


class Command(BaseCommand):
    help = "Create and verify the private Recorder bucket."

    def handle(self, *args, **options):
        storage = recording_storage()
        client, bucket = storage.s3_client, storage.aws_storage_bucket_name
        try:
            try:
                client.head_bucket(Bucket=bucket)
            except ClientError as exc:
                if exc.response["Error"]["Code"] not in ("404", "NoSuchBucket"):
                    raise
                client.create_bucket(Bucket=bucket)
            try:
                policy = client.get_bucket_policy(Bucket=bucket)
            except ClientError as exc:
                if exc.response["Error"]["Code"] != "NoSuchBucketPolicy":
                    raise
            else:
                if any(statement.get("Effect") == "Allow" for statement in json.loads(policy["Policy"])["Statement"]):
                    raise CommandError(
                        "Recorder bucket must not have an Allow bucket policy. Use a dedicated private bucket."
                    )
            acl = client.get_bucket_acl(Bucket=bucket)
            if any(
                "AllUsers" in grant.get("Grantee", {}).get("URI", "")
                or "AuthenticatedUsers" in grant.get("Grantee", {}).get("URI", "")
                for grant in acl["Grants"]
            ):
                raise CommandError("Recorder bucket must not have a public ACL.")
        except ClientError as exc:
            raise CommandError(f"Cannot prepare Recorder storage: {exc}") from exc
        self.stdout.write(self.style.SUCCESS(f"Private Recorder bucket '{bucket}' is ready."))
