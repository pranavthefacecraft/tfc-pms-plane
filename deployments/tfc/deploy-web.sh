#!/usr/bin/env bash
set -Eeuo pipefail

revision=${1:?A release commit SHA is required}
expected_image=${2:?An image ID is required}
expected_manifest=${3:?A manifest ID is required}
[[ "$revision" =~ ^[a-f0-9]{40}$ ]]
[[ "$expected_image" =~ ^sha256:[a-f0-9]{64}$ ]]
[[ "$expected_manifest" =~ ^sha256:[a-f0-9]{64}$ ]]

cd /opt/tfcpms
exec 9>.web-deploy.lock
flock -n 9 || { echo "Another web deployment is running" >&2; exit 1; }

release="tfcpms/plane-frontend:$revision"
latest="tfcpms/plane-frontend:latest"
rollback="tfcpms/plane-frontend:rollback-$revision"
release_image=$(docker image inspect "$release" --format '{{.Id}}')
if [[ "$release_image" != "$expected_image" && "$release_image" != "$expected_manifest" ]]; then
  echo "Loaded release identity does not match the verified artifact" >&2
  exit 1
fi
container=$(docker compose ps -q web)
test -n "$container"
[[ "$(docker inspect "$container" --format '{{.Config.Image}}')" == "$latest" ]]
previous=$(docker inspect "$container" --format '{{.Image}}')
if [[ "$previous" == "$release_image" ]]; then
  [[ "$(docker inspect "$container" --format '{{.State.Health.Status}}')" == healthy ]]
  echo "This web image is already deployed; preserving the existing rollback tag"
  exit 0
fi
docker tag "$previous" "$rollback"

wait_healthy() {
  local container_id
  for _ in {1..30}; do
    container_id=$(docker compose ps -q web)
    if [[ -n "$container_id" ]] &&
      [[ "$(docker inspect "$container_id" --format '{{.State.Health.Status}}')" == healthy ]]; then
      return 0
    fi
    sleep 5
  done
  echo "Web did not become healthy" >&2
  return 1
}

restore_previous() {
  local status=$?
  trap - ERR HUP INT TERM
  set +e
  echo "Deployment failed; restoring $rollback" >&2
  docker tag "$rollback" "$latest"
  docker compose up -d --no-deps --no-build --pull never web
  if wait_healthy; then
    echo "Previous web image restored" >&2
  else
    echo "ROLLBACK FAILED: manual intervention required" >&2
  fi
  exit "$((status == 0 ? 1 : status))"
}
trap restore_previous ERR HUP INT TERM

docker tag "$release" "$latest"
docker compose up -d --no-deps --no-build --pull never web
wait_healthy
container=$(docker compose ps -q web)
running_image=$(docker inspect "$container" --format '{{.Image}}')
if [[ "$running_image" != "$expected_image" && "$running_image" != "$expected_manifest" ]]; then
  echo "Running web identity does not match the verified artifact" >&2
  false
fi
curl --fail --silent --show-error --retry 5 --retry-delay 3 --max-time 15 \
  https://tfcpms.tfcmockup.com/ > /dev/null
curl --fail --silent --show-error --retry 5 --retry-delay 3 --max-time 15 \
  https://tfcpms.tfcmockup.com/api/instances/ > /dev/null
trap - ERR HUP INT TERM
echo "Deployed web commit $revision; rollback image: $rollback"
