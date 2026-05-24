DELETE FROM app_feature_flags WHERE feature_key = 'meeting_notes';
DELETE FROM app_feature_flags_business WHERE feature_key = 'meeting_notes';

DROP TABLE IF EXISTS meeting_notes;
