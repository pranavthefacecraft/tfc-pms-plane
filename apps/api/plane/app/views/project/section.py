# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import transaction
from django.db.models import Max
from rest_framework import status
from rest_framework.response import Response

from plane.app.permissions import ROLE, allow_permission
from plane.app.serializers.section import SectionSerializer
from plane.app.views.base import BaseAPIView
from plane.db.models import DraftIssue, Issue, Project, Section


class ProjectSectionsEndpoint(BaseAPIView):
    def _project(self, slug, project_id):
        return Project.objects.filter(id=project_id, workspace__slug=slug).first()

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def get(self, request, slug, project_id):
        project = self._project(slug, project_id)
        if project is None:
            return Response({"error": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

        sections = Section.objects.filter(project=project, workspace__slug=slug).order_by("sort_order", "name")
        return Response(SectionSerializer(sections, many=True).data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def post(self, request, slug, project_id):
        project = self._project(slug, project_id)
        if project is None:
            return Response({"error": "Project not found"}, status=status.HTTP_404_NOT_FOUND)
        if project.archived_at is not None:
            return Response({"error": "Archived projects are read-only"}, status=status.HTTP_403_FORBIDDEN)

        serializer = SectionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        sort_order = serializer.validated_data.get("sort_order")
        if sort_order is None:
            largest = Section.objects.filter(project=project).aggregate(largest=Max("sort_order"))["largest"]
            sort_order = largest + 10000 if largest is not None else 65535

        section = Section.objects.create(
            name=serializer.validated_data["name"],
            sort_order=sort_order,
            project=project,
            workspace=project.workspace,
        )
        return Response(SectionSerializer(section).data, status=status.HTTP_201_CREATED)


class ProjectSectionEndpoint(BaseAPIView):
    def _project(self, slug, project_id):
        return Project.objects.filter(id=project_id, workspace__slug=slug).first()

    def _section(self, slug, project_id, pk):
        return Section.objects.filter(
            id=pk,
            project_id=project_id,
            workspace__slug=slug,
        ).first()

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def get(self, request, slug, project_id, pk):
        section = self._section(slug, project_id, pk)
        if section is None:
            return Response({"error": "Section not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(SectionSerializer(section).data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def patch(self, request, slug, project_id, pk):
        project = self._project(slug, project_id)
        if project is None:
            return Response({"error": "Project not found"}, status=status.HTTP_404_NOT_FOUND)
        if project.archived_at is not None:
            return Response({"error": "Archived projects are read-only"}, status=status.HTTP_403_FORBIDDEN)

        section = self._section(slug, project_id, pk)
        if section is None:
            return Response({"error": "Section not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = SectionSerializer(section, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(SectionSerializer(section).data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def delete(self, request, slug, project_id, pk):
        project = self._project(slug, project_id)
        if project is None:
            return Response({"error": "Project not found"}, status=status.HTTP_404_NOT_FOUND)
        if project.archived_at is not None:
            return Response({"error": "Archived projects are read-only"}, status=status.HTTP_403_FORBIDDEN)

        section = self._section(slug, project_id, pk)
        if section is None:
            return Response({"error": "Section not found"}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            Issue.all_objects.filter(section=section).update(section=None)
            DraftIssue.all_objects.filter(section=section).update(section=None)
            section.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
