from functools import wraps
from uuid import UUID

from rest_framework.exceptions import PermissionDenied

from plane.app.permissions import ROLE, allow_permission
from plane.app.views.page.workspace import WorkspacePageMixin
from plane.db.models import FileAsset, Page, WorkspaceMember


def allow_notepad_asset(func):
    workspace_only = allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")(func)

    @wraps(func)
    def wrapped(self, request, slug, *args, **kwargs):
        asset_id = kwargs.get("asset_id")
        asset = FileAsset.objects.filter(pk=asset_id, workspace__slug=slug).first() if asset_id else None
        page_ids = set()
        if asset and asset.entity_type == FileAsset.EntityTypeContext.PAGE_DESCRIPTION and asset.page_id:
            page_ids.add(asset.page_id)
        if request.method == "POST" and request.data.get("entity_type") == FileAsset.EntityTypeContext.PAGE_DESCRIPTION:
            from plane.app.views.page.workspace import _is_uuid

            entity_id = request.data.get("entity_identifier") or request.data.get("entity_id")
            if not _is_uuid(entity_id):
                raise PermissionDenied("A valid notepad is required.")
            page_ids.add(str(entity_id))
        notepads = Page.objects.filter(
            pk__in=page_ids, workspace__slug=slug, is_global=True, tool_type=Page.TOOL_TYPE_PAGE
        )
        if not notepads.exists():
            return workspace_only(self, request, slug=slug, *args, **kwargs)
        mixin = WorkspacePageMixin()
        accessible = mixin.get_pages(request, slug)
        for page in notepads:
            if request.user.is_bot or not accessible.filter(pk=page.id).exists():
                raise PermissionDenied("You do not have access to this notepad.")
            if request.method not in ("GET", "HEAD"):
                mixin.require_editor(page, request.user)
        is_member = WorkspaceMember.objects.filter(workspace__slug=slug, member=request.user, is_active=True).exists()
        if not is_member:
            # Guests may not change entity type, target another page, or copy unrelated assets.
            if request.method == "POST" and (
                request.data.get("entity_type") != FileAsset.EntityTypeContext.PAGE_DESCRIPTION
                or request.data.get("project_id")
                or UUID(str(request.data.get("entity_identifier") or request.data.get("entity_id")))
                not in {page.id for page in notepads}
                or (asset_id and (asset is None or asset.page_id not in {page.id for page in notepads}))
            ):
                raise PermissionDenied("Notepad-only collaborators cannot access other assets.")
        return func(self, request, slug=slug, *args, **kwargs)

    return wrapped
