import hashlib
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest

from verify_web_artifact import verify_image_archive


class VerifyWebArtifactTests(unittest.TestCase):
    revision = "a" * 40

    def artifact(self, nested=False, defect=None):
        files = {}

        def blob(data):
            encoded = json.dumps(data).encode()
            digest = "sha256:" + hashlib.sha256(encoded).hexdigest()
            files["blobs/sha256/" + digest.split(":")[1]] = encoded
            return {"digest": digest}

        config = blob({"os": "linux", "architecture": "amd64", "config": {}})
        image = blob({"schemaVersion": 2, "config": config})
        root = image
        if nested:
            child = {**image, "platform": {"os": "linux", "architecture": "amd64"}}
            children = [
                child,
                {**blob({"attestation": True}), "platform": {"os": "unknown", "architecture": "unknown"}},
            ]
            if defect == "duplicate-platform":
                children.append(child)
            if defect == "wrong-platform":
                child["platform"]["architecture"] = "arm64"
            root = blob({"schemaVersion": 2, "manifests": children})
        files["index.json"] = json.dumps({"schemaVersion": 2, "manifests": [root]}).encode()
        files["manifest.json"] = json.dumps(
            [
                {
                    "RepoTags": [f"tfcpms/plane-frontend:{'b' * 40 if defect == 'wrong-tag' else self.revision}"],
                    "Config": "blobs/sha256/" + config["digest"].split(":")[1],
                }
            ]
        ).encode()
        if defect == "tampered-manifest":
            files["blobs/sha256/" + image["digest"].split(":")[1]] = b"{}"
        if defect == "tampered-config":
            files["blobs/sha256/" + config["digest"].split(":")[1]] = (
                b'{"os":"linux","architecture":"amd64","changed":true}'
            )
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        path = Path(temporary.name) / "image.tar.gz"
        with tarfile.open(path, "w:gz") as archive:
            for name, data in files.items():
                member = tarfile.TarInfo(name)
                member.size = len(data)
                archive.addfile(member, io.BytesIO(data))
        return path, config["digest"], root["digest"]

    def test_accepts_direct_manifest_and_provenance_index(self):
        for nested in (False, True):
            with self.subTest(nested=nested):
                path, config, root = self.artifact(nested)
                self.assertEqual(verify_image_archive(path, self.revision), (config, root))

    def test_rejects_modified_content_and_incorrect_release(self):
        for nested in (False, True):
            for defect in ("tampered-manifest", "tampered-config", "wrong-tag"):
                with self.subTest(nested=nested, defect=defect):
                    path, _, _ = self.artifact(nested, defect)
                    with self.assertRaises(ValueError):
                        verify_image_archive(path, self.revision)

    def test_rejects_missing_or_ambiguous_platform(self):
        for defect in ("wrong-platform", "duplicate-platform"):
            with self.subTest(defect=defect):
                path, _, _ = self.artifact(True, defect)
                with self.assertRaisesRegex(ValueError, "exactly one Linux amd64"):
                    verify_image_archive(path, self.revision)


if __name__ == "__main__":
    unittest.main()
