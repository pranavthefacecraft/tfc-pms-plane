from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from plane.app.views.workspace.recording import STORAGE_ERRORS, delete_recording_object, recording_storage
from plane.db.models import Recording
from plane.utils.exception_logger import log_exception


class Command(BaseCommand):
    help = "Remove unfinished recording uploads older than 24 hours. Schedule daily."

    def handle(self, *args, **options):
        storage = recording_storage()
        ids = Recording.objects.filter(ready=False, created_at__lt=timezone.now() - timedelta(days=1)).values_list(
            "id", flat=True
        )
        removed = 0
        for pk in ids.iterator():
            with transaction.atomic():
                recording = Recording.objects.select_for_update().filter(pk=pk, ready=False).first()
                if recording is None:
                    continue
                try:
                    delete_recording_object(storage, recording)
                except STORAGE_ERRORS as exc:
                    log_exception(exc)
                    raise CommandError(f"Cannot clean recording {pk}; retry the command.") from exc
                recording.delete()
                removed += 1
        try:
            for page in storage.s3_client.get_paginator("list_multipart_uploads").paginate(
                Bucket=storage.aws_storage_bucket_name, Prefix="recordings/"
            ):
                for upload in page.get("Uploads", []):
                    if upload["Initiated"] < timezone.now() - timedelta(days=1):
                        storage.s3_client.abort_multipart_upload(
                            Bucket=storage.aws_storage_bucket_name, Key=upload["Key"], UploadId=upload["UploadId"]
                        )
        except STORAGE_ERRORS as exc:
            log_exception(exc)
            raise CommandError("Cannot clean orphan recording uploads; retry the command.") from exc
        self.stdout.write(self.style.SUCCESS(f"Removed {removed} abandoned recordings."))
