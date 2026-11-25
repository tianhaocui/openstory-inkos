CREATE TABLE `story_chapter_summaries` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`project_id` text NOT NULL,
	`chapter` integer NOT NULL,
	`title` text NOT NULL,
	`characters` text DEFAULT '' NOT NULL,
	`events` text DEFAULT '' NOT NULL,
	`state_changes` text DEFAULT '' NOT NULL,
	`hook_activity` text DEFAULT '' NOT NULL,
	`mood` text DEFAULT '' NOT NULL,
	`chapter_type` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	CONSTRAINT `fk_story_chapter_summaries_project_id_story_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `story_projects`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `story_chapters` (
	`id` text PRIMARY KEY,
	`project_id` text NOT NULL,
	`chapter_number` integer NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`word_count` integer DEFAULT 0 NOT NULL,
	`generated_by` text,
	`generation_prompt` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	CONSTRAINT `fk_story_chapters_project_id_story_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `story_projects`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `story_characters` (
	`id` text PRIMARY KEY,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`traits` text,
	`backstory` text,
	`voice_notes` text,
	`openstory_character_id` text,
	`introduced_in_chapter` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	CONSTRAINT `fk_story_characters_project_id_story_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `story_projects`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `story_facts` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`project_id` text NOT NULL,
	`subject` text NOT NULL,
	`predicate` text NOT NULL,
	`object` text NOT NULL,
	`valid_from_chapter` integer NOT NULL,
	`valid_until_chapter` integer,
	`source_chapter` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	CONSTRAINT `fk_story_facts_project_id_story_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `story_projects`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `story_hooks` (
	`id` text PRIMARY KEY,
	`project_id` text NOT NULL,
	`hook_id` text NOT NULL,
	`start_chapter` integer DEFAULT 0 NOT NULL,
	`type` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`last_advanced_chapter` integer DEFAULT 0 NOT NULL,
	`expected_payoff` text DEFAULT '' NOT NULL,
	`payoff_timing` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`depends_on` text,
	`pays_off_in_arc` text,
	`core_hook` integer DEFAULT false,
	`half_life_chapters` integer,
	`advanced_count` integer DEFAULT 0,
	`promoted` integer DEFAULT false,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	CONSTRAINT `fk_story_hooks_project_id_story_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `story_projects`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `story_projects` (
	`id` text PRIMARY KEY,
	`team_id` text NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`settings` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	CONSTRAINT `fk_story_projects_team_id_teams_id_fk` FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_story_projects_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `story_summaries_project_chapter_idx` ON `story_chapter_summaries` (`project_id`,`chapter`);--> statement-breakpoint
CREATE INDEX `story_chapters_project_idx` ON `story_chapters` (`project_id`);--> statement-breakpoint
CREATE INDEX `story_chapters_project_number_idx` ON `story_chapters` (`project_id`,`chapter_number`);--> statement-breakpoint
CREATE INDEX `story_characters_project_idx` ON `story_characters` (`project_id`);--> statement-breakpoint
CREATE INDEX `story_characters_name_idx` ON `story_characters` (`project_id`,`name`);--> statement-breakpoint
CREATE INDEX `story_facts_project_idx` ON `story_facts` (`project_id`);--> statement-breakpoint
CREATE INDEX `story_facts_subject_idx` ON `story_facts` (`project_id`,`subject`);--> statement-breakpoint
CREATE INDEX `story_facts_predicate_idx` ON `story_facts` (`project_id`,`predicate`);--> statement-breakpoint
CREATE INDEX `story_facts_valid_idx` ON `story_facts` (`project_id`,`valid_from_chapter`,`valid_until_chapter`);--> statement-breakpoint
CREATE INDEX `story_facts_source_idx` ON `story_facts` (`project_id`,`source_chapter`);--> statement-breakpoint
CREATE INDEX `story_hooks_project_idx` ON `story_hooks` (`project_id`);--> statement-breakpoint
CREATE INDEX `story_hooks_project_hook_idx` ON `story_hooks` (`project_id`,`hook_id`);--> statement-breakpoint
CREATE INDEX `story_hooks_status_idx` ON `story_hooks` (`project_id`,`status`);--> statement-breakpoint
CREATE INDEX `story_hooks_last_advanced_idx` ON `story_hooks` (`project_id`,`last_advanced_chapter`);--> statement-breakpoint
CREATE INDEX `story_projects_team_idx` ON `story_projects` (`team_id`);--> statement-breakpoint
CREATE INDEX `story_projects_user_idx` ON `story_projects` (`user_id`);