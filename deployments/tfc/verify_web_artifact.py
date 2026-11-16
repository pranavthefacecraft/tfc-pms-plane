import argparse
import hashlib
import json
import os
import re
import tarfile


def verify_image_archive(path, revision):
    if not re.fullmatch(r"[a-f0-9]{40}", revision):
        raise ValueError("Invalid release revision")
    with tarfile.open(path, "r:gz") as archive:
        manifest = json.load(archive.extractfile("manifest.json"))
        expected_tag = f"tfcpms/plane-frontend:{revision}"
        if len(manifest) != 1 or expected_tag not in manifest[0]["RepoTags"]:
            raise ValueError("Artifact does not contain the expected release")
        config_bytes = archive.extractfile(manifest[0]["Config"]).read()
        image_id = "sha256:" + hashlib.sha256(config_bytes).hexdigest()
        config = json.loads(config_bytes)
        if config.get("os") != "linux" or config.get("architecture") != "amd64":
            raise ValueError("Expected a Linux amd64 release")

        def verified_blob(descriptor):
            digest = descriptor["digest"]
            if not re.fullmatch(r"sha256:[a-f0-9]{64}", digest):
                raise ValueError("Invalid manifest digest")
            data = archive.extractfile(f"blobs/sha256/{digest.split(':')[1]}").read()
            if "sha256:" + hashlib.sha256(data).hexdigest() != digest:
                raise ValueError("Manifest checksum mismatch")
            return json.loads(data)

        index = json.load(archive.extractfile("index.json"))
        if len(index["manifests"]) != 1:
            raise ValueError("Expected a single release manifest")
        descriptor = index["manifests"][0]
        manifest_id = descriptor["digest"]
        release = verified_blob(descriptor)
        if "manifests" in release:
            images = [
                child
                for child in release["manifests"]
                if child.get("platform", {}).get("os") == "linux"
                and child.get("platform", {}).get("architecture") == "amd64"
            ]
            if len(images) != 1:
                raise ValueError("Expected exactly one Linux amd64 image in the release index")
            release = verified_blob(images[0])
        if release.get("config", {}).get("digest") != image_id:
            raise ValueError("Manifest configuration mismatch")
        return image_id, manifest_id


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("archive")
    parser.add_argument("revision")
    args = parser.parse_args()
    image_id, manifest_id = verify_image_archive(args.archive, args.revision)
    with open(os.environ["GITHUB_ENV"], "a") as environment:
        environment.write(f"RELEASE_IMAGE_ID={image_id}\n")
        environment.write(f"RELEASE_MANIFEST_ID={manifest_id}\n")
    print(f"Verified release {args.revision}: {image_id}, {manifest_id}")
