# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from functools import lru_cache

from django.db import transaction
from redis.exceptions import RedisError

from plane.settings.redis import redis_instance
from plane.utils.exception_logger import log_exception


@lru_cache(maxsize=1)
def _publisher():
    return redis_instance(socket_timeout=1, socket_connect_timeout=1)


def publish_task_update(workspace_id, using=None):
    if workspace_id is None:
        return

    def publish():
        try:
            # Invalidation only: private task data remains behind the REST permissions.
            _publisher().publish(f"plane:task-updates:{workspace_id}", "invalidate")
        except RedisError as exc:
            log_exception(exc)

    transaction.on_commit(publish, using=using)
