import pytest

from plane.db.models import Profile


@pytest.mark.contract
@pytest.mark.django_db
class TestOutOfOffice:
    def test_schedule_round_trip_clear_and_unrelated_updates(self, session_client, create_user):
        profile, _ = Profile.objects.get_or_create(user=create_user)
        url = "/api/users/me/profile/"
        schedule = {"start_date": "2026-11-23", "end_date": "2026-11-25", "message": "Back Thursday"}
        response = session_client.patch(url, {"out_of_office": schedule}, format="json")
        assert response.status_code == 200
        assert response.data["out_of_office"] == schedule
        profile.refresh_from_db()
        assert profile.out_of_office == schedule
        assert session_client.get(url).data["out_of_office"] == schedule
        response = session_client.patch(url, {"language": "en"}, format="json")
        assert response.data["out_of_office"] == schedule
        response = session_client.patch(url, {"out_of_office": None}, format="json")
        assert response.status_code == 200
        assert session_client.get(url).data["out_of_office"] is None

    @pytest.mark.parametrize("schedule", [
        {"start_date": "2026-11-25", "end_date": "2026-11-23"},
        {"start_date": "not-a-date", "end_date": "2026-11-25"},
        {"start_date": "2026-11-23"},
        {},
        {"start_date": "2026-11-23", "end_date": "2026-11-25", "message": "x" * 501},
    ])
    def test_invalid_schedule_is_rejected_without_overwriting_saved_dates(self, session_client, create_user, schedule):
        existing = {"start_date": "2026-11-23", "end_date": "2026-11-23", "message": ""}
        profile, _ = Profile.objects.get_or_create(user=create_user)
        profile.out_of_office = existing
        profile.save()
        response = session_client.patch("/api/users/me/profile/", {"out_of_office": schedule}, format="json")
        assert response.status_code == 400
        profile.refresh_from_db()
        assert profile.out_of_office == existing
