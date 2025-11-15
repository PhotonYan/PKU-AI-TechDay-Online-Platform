from __future__ import annotations

from typing import Iterable, List, Optional

from .. import models


def _award_records(submission: models.Submission, visible_ids: Optional[Iterable[int]] = None):
    if not submission.award_records:
        return []
    if not visible_ids:
        return [record for record in submission.award_records if record.award]
    visible_set = set(visible_ids)
    return [record for record in submission.award_records if record.award and record.award_id in visible_set]


def compute_award_tags(submission: models.Submission, visible_award_ids: Optional[Iterable[int]] = None) -> List[str]:
    tags: List[str] = []
    if submission.recommendations:
        tags.append("推荐")
    for record in _award_records(submission, visible_award_ids):
        if record.award:
            tags.append(record.award.name)
    if not tags:
        return ["无"]
    return tags


def compute_award_badges(submission: models.Submission, visible_award_ids: Optional[Iterable[int]] = None) -> List[dict]:
    badges: List[dict] = []
    for record in _award_records(submission, visible_award_ids):
        if not record.award:
            continue
        badges.append(
            {
                "name": record.award.name,
                "color": record.award.color,
            }
        )
    return badges


def update_submission_award_text(submission: models.Submission) -> None:
    tags = [tag for tag in compute_award_tags(submission) if tag not in {"无", "推荐"}]
    submission.award = ",".join(tags) if tags else None
