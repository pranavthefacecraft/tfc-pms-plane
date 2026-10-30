import json
from uuid import uuid4

from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.html import escape
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from plane.app.permissions import ROLE, allow_permission
from plane.app.serializers.issue import IssueCreateSerializer
from plane.app.serializers.personal_task import PersonalTaskSerializer
from plane.app.views.base import BaseAPIView
from plane.db.models import PersonalTask, Project, ProjectMember, State, Workspace
from plane.bgtasks.issue_activities_task import issue_activity
from plane.utils.host import base_host


def owned_tasks(request, slug):
    return PersonalTask.objects.filter(owner=request.user, workspace__slug=slug)


class PersonalTasksEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def get(self, request, slug):
        tasks = owned_tasks(request, slug).filter(moved_at__isnull=True)
        return Response(PersonalTaskSerializer(tasks, many=True).data)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def post(self, request, slug):
        serializer = PersonalTaskSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(owner=request.user, workspace=get_object_or_404(Workspace, slug=slug))
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class PersonalTaskEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def patch(self, request, slug, pk):
        with transaction.atomic():
            task = get_object_or_404(owned_tasks(request, slug).select_for_update(), pk=pk, moved_at__isnull=True)
            serializer = PersonalTaskSerializer(task, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
        return Response(serializer.data)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def delete(self, request, slug, pk):
        with transaction.atomic():
            task = get_object_or_404(owned_tasks(request, slug).select_for_update(), pk=pk, moved_at__isnull=True)
            task.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PersonalTaskShareEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def get(self, request, slug, pk):
        task = get_object_or_404(owned_tasks(request, slug), pk=pk, moved_at__isnull=True)
        return Response({"token": str(task.share_token) if task.share_token else None})

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def post(self, request, slug, pk):
        with transaction.atomic():
            task = get_object_or_404(owned_tasks(request, slug).select_for_update(), pk=pk, moved_at__isnull=True)
            if task.share_token is None:
                task.share_token = uuid4()
                task.save(update_fields=["share_token", "updated_at"])
        return Response({"token": str(task.share_token)})

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def delete(self, request, slug, pk):
        with transaction.atomic():
            task = get_object_or_404(owned_tasks(request, slug).select_for_update(), pk=pk, moved_at__isnull=True)
            task.share_token = None
            task.save(update_fields=["share_token", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class SharedPersonalTaskEndpoint(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, token):
        task = get_object_or_404(PersonalTask.objects, share_token=token, moved_at__isnull=True)
        response = Response(
            {
                "name": task.name,
                "description": task.description,
                "priority": task.priority,
                "start_date": task.start_date,
                "target_date": task.target_date,
                "completed_at": task.completed_at,
            }
        )
        response["Cache-Control"] = "no-store"
        response["X-Robots-Tag"] = "noindex, nofollow"
        response["Referrer-Policy"] = "no-referrer"
        return response


class MovePersonalTaskSerializer(serializers.Serializer):
    project_id = serializers.UUIDField()


class MovePersonalTaskEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def post(self, request, slug, pk):
        payload = MovePersonalTaskSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        project = get_object_or_404(
            Project, pk=payload.validated_data["project_id"], workspace__slug=slug, archived_at__isnull=True
        )
        membership = ProjectMember.objects.filter(project=project, member=request.user, is_active=True).first()
        if membership is None or membership.role < ROLE.MEMBER.value:
            return Response({"error": "You must be a project member to move tasks here."}, status=403)

        with transaction.atomic():
            task = get_object_or_404(owned_tasks(request, slug).select_for_update(), pk=pk)
            if task.moved_at is not None:
                return Response({"error": "This personal task has already been moved."}, status=409)
            groups = ["completed"] if task.completed_at else ["backlog", "unstarted", "started"]
            state = (
                State.objects.filter(project=project, group__in=groups).order_by("-default", "sequence", "id").first()
            )
            if state is None:
                return Response(
                    {"error": "The project needs a matching open or completed state before moving this task."},
                    status=400,
                )
            serializer = IssueCreateSerializer(
                data={
                    "name": task.name,
                    "description_html": f"<p>{escape(task.description).replace(chr(10), '<br>')}</p>",
                    "priority": task.priority,
                    "start_date": task.start_date,
                    "target_date": task.target_date,
                    "assignee_ids": [str(request.user.id)],
                    "state_id": str(state.id),
                },
                context={
                    "project_id": project.id,
                    "workspace_id": project.workspace_id,
                    "default_assignee_id": request.user.id,
                },
            )
            serializer.is_valid(raise_exception=True)
            issue = serializer.save()
            if task.completed_at:
                type(issue).objects.filter(pk=issue.pk).update(completed_at=task.completed_at)
            task.moved_at = timezone.now()
            task.moved_issue = issue
            task.save(update_fields=["moved_at", "moved_issue", "updated_at"])
            transaction.on_commit(
                lambda: issue_activity.delay(
                    type="issue.activity.created",
                    requested_data=json.dumps(serializer.initial_data, cls=DjangoJSONEncoder),
                    actor_id=str(request.user.id),
                    issue_id=str(issue.id),
                    project_id=str(project.id),
                    current_instance=None,
                    epoch=int(timezone.now().timestamp()),
                    notification=True,
                    origin=base_host(request=request, is_app=True),
                )
            )
        return Response(
            {"id": str(issue.id), "project_id": str(project.id), "name": issue.name},
            status=status.HTTP_201_CREATED,
        )
