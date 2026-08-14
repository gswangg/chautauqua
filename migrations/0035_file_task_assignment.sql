-- DEC-248 amendment (wave 10): a file uploaded through a kind='form' task
-- field was written only into task_assignment.response_json, with no column
-- pointing back at it -- getTaskFileScope could never resolve such a file,
-- so it could never be served. `file` gets a direct task_assignment_id link
-- so form-task uploads join back to their assignment (and from there to the
-- owning task/event) the same way task_assignment.file_id already does for
-- the plain upload path.

ALTER TABLE `file` ADD `task_assignment_id` text;

CREATE INDEX `file_task_assignment_id_idx` ON `file` (`task_assignment_id`);
