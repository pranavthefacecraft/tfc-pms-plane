from django.utils import timezone
from rest_framework import serializers

from plane.db.models import PersonalTask


class PersonalTaskSerializer(serializers.ModelSerializer):
    is_completed = serializers.BooleanField(write_only=True, required=False)
    description = serializers.CharField(required=False, allow_blank=True, max_length=20000)

    class Meta:
        model = PersonalTask
        fields = (
            "id",
            "name",
            "description",
            "priority",
            "start_date",
            "target_date",
            "completed_at",
            "is_completed",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "completed_at", "created_at", "updated_at")

    def validate(self, attrs):
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        target = attrs.get("target_date", getattr(self.instance, "target_date", None))
        if self.instance is None and not start and not target:
            attrs["target_date"] = timezone.localdate()
        if start and target and start > target:
            raise serializers.ValidationError({"target_date": "Due date must be on or after the start date."})
        if "is_completed" in attrs:
            completed = attrs.pop("is_completed")
            attrs["completed_at"] = (
                (getattr(self.instance, "completed_at", None) or timezone.now()) if completed else None
            )
        return attrs
