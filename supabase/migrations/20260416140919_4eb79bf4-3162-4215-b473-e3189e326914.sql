-- Clean remaining topic duplicates after subject merge
DO $$
DECLARE
  dup RECORD;
  keep_id UUID;
  del_ids UUID[];
BEGIN
  FOR dup IN
    SELECT user_id, subject_id, name
    FROM topics
    GROUP BY user_id, subject_id, name
    HAVING COUNT(*) > 1
  LOOP
    SELECT id INTO keep_id FROM topics
    WHERE user_id = dup.user_id AND subject_id = dup.subject_id AND name = dup.name
    ORDER BY created_at ASC LIMIT 1;

    SELECT array_agg(id) INTO del_ids FROM topics
    WHERE user_id = dup.user_id AND subject_id = dup.subject_id AND name = dup.name AND id != keep_id;

    UPDATE study_logs SET topic_id = keep_id WHERE topic_id = ANY(del_ids);
    UPDATE memory_scores SET topic_id = keep_id WHERE topic_id = ANY(del_ids);
    UPDATE ai_recommendations SET topic_id = keep_id WHERE topic_id = ANY(del_ids);
    UPDATE brain_missions SET target_topic_id = keep_id WHERE target_topic_id = ANY(del_ids);
    UPDATE weakness_predictions SET topic_id = keep_id WHERE topic_id = ANY(del_ids);
    UPDATE autopilot_sessions SET emergency_topic_id = keep_id WHERE emergency_topic_id = ANY(del_ids);
    UPDATE topic_decay_models SET topic_id = keep_id WHERE topic_id = ANY(del_ids);
    UPDATE behavioral_micro_events SET topic_id = keep_id WHERE topic_id = ANY(del_ids);
    UPDATE exam_intel_topic_scores SET topic_id = keep_id WHERE topic_id = ANY(del_ids);
    UPDATE ca_probability_adjustments SET topic_id = keep_id WHERE topic_id = ANY(del_ids);

    DELETE FROM topics WHERE id = ANY(del_ids);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS topics_user_id_subject_id_name_unique ON public.topics (user_id, subject_id, name);