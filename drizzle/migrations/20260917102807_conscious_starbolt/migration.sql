CREATE TABLE `story_asset_views` (
	`id` text PRIMARY KEY,
	`asset_id` text NOT NULL,
	`view_angle` text NOT NULL,
	`prompt` text,
	`image_url` text,
	`image_path` text,
	`generated_by` text,
	`generation_params` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	CONSTRAINT `fk_story_asset_views_asset_id_story_assets_id_fk` FOREIGN KEY (`asset_id`) REFERENCES `story_assets`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `story_assets` (
	`id` text PRIMARY KEY,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`character_id` text,
	`scene_name` text,
	`description` text NOT NULL,
	`style_notes` text,
	`color_palette` text,
	`visual_identifiers` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	CONSTRAINT `fk_story_assets_project_id_story_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `story_projects`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `story_film_settings` (
	`id` text PRIMARY KEY,
	`project_id` text NOT NULL UNIQUE,
	`aspect_ratio` text DEFAULT '9:16' NOT NULL,
	`resolution` text DEFAULT '1080x1920' NOT NULL,
	`frame_rate` integer DEFAULT 24 NOT NULL,
	`target_duration` integer,
	`segment_duration` integer DEFAULT 15 NOT NULL,
	`visual_style` text,
	`color_grading` text,
	`has_voiceover` integer DEFAULT false,
	`has_soundtrack` integer DEFAULT true,
	`preferred_video_model` text,
	`preferred_image_model` text,
	`export_format` text DEFAULT 'mp4' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	CONSTRAINT `fk_story_film_settings_project_id_story_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `story_projects`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `story_keyframes` (
	`id` text PRIMARY KEY,
	`project_id` text NOT NULL,
	`segment_id` text,
	`shot_id` text,
	`name` text NOT NULL,
	`selection_reason` text,
	`description` text NOT NULL,
	`prompt` text,
	`aspect_ratio` text DEFAULT '9:16' NOT NULL,
	`image_url` text,
	`image_path` text,
	`reference_assets` text,
	`generated_by` text,
	`generation_params` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	CONSTRAINT `fk_story_keyframes_project_id_story_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `story_projects`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_story_keyframes_segment_id_story_segments_id_fk` FOREIGN KEY (`segment_id`) REFERENCES `story_segments`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_story_keyframes_shot_id_story_shots_id_fk` FOREIGN KEY (`shot_id`) REFERENCES `story_shots`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `story_segments` (
	`id` text PRIMARY KEY,
	`project_id` text NOT NULL,
	`chapter_number` integer NOT NULL,
	`segment_number` integer NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`duration` integer DEFAULT 15 NOT NULL,
	`narrative_function` text,
	`summary` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	CONSTRAINT `fk_story_segments_project_id_story_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `story_projects`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `story_shots` (
	`id` text PRIMARY KEY,
	`segment_id` text NOT NULL,
	`project_id` text NOT NULL,
	`shot_number` integer NOT NULL,
	`start_time` text NOT NULL,
	`duration` real NOT NULL,
	`shot_size` text,
	`camera_angle` text,
	`camera_movement` text,
	`description` text NOT NULL,
	`action` text,
	`dialogue` text,
	`characters` text,
	`sound_effects` text,
	`music` text,
	`ambience` text,
	`transition` text DEFAULT 'cut',
	`keyframe_id` text,
	`video_clip_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	CONSTRAINT `fk_story_shots_segment_id_story_segments_id_fk` FOREIGN KEY (`segment_id`) REFERENCES `story_segments`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_story_shots_project_id_story_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `story_projects`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `story_video_clips` (
	`id` text PRIMARY KEY,
	`project_id` text NOT NULL,
	`keyframe_id` text,
	`segment_id` text,
	`name` text NOT NULL,
	`duration` integer DEFAULT 15 NOT NULL,
	`aspect_ratio` text DEFAULT '9:16' NOT NULL,
	`prompt` text,
	`motion_prompt` text,
	`video_url` text,
	`video_path` text,
	`thumbnail_url` text,
	`thumbnail_path` text,
	`generated_by` text,
	`generation_params` text,
	`quality_score` real,
	`status` text DEFAULT 'pending' NOT NULL,
	`error_message` text,
	`queued_at` text,
	`started_at` text,
	`completed_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	CONSTRAINT `fk_story_video_clips_project_id_story_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `story_projects`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_story_video_clips_keyframe_id_story_keyframes_id_fk` FOREIGN KEY (`keyframe_id`) REFERENCES `story_keyframes`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_story_video_clips_segment_id_story_segments_id_fk` FOREIGN KEY (`segment_id`) REFERENCES `story_segments`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX `story_asset_views_asset_idx` ON `story_asset_views` (`asset_id`);--> statement-breakpoint
CREATE INDEX `story_asset_views_angle_idx` ON `story_asset_views` (`asset_id`,`view_angle`);--> statement-breakpoint
CREATE INDEX `story_assets_project_idx` ON `story_assets` (`project_id`);--> statement-breakpoint
CREATE INDEX `story_assets_type_idx` ON `story_assets` (`project_id`,`type`);--> statement-breakpoint
CREATE INDEX `story_assets_character_idx` ON `story_assets` (`project_id`,`character_id`);--> statement-breakpoint
CREATE INDEX `story_film_settings_project_idx` ON `story_film_settings` (`project_id`);--> statement-breakpoint
CREATE INDEX `story_keyframes_project_idx` ON `story_keyframes` (`project_id`);--> statement-breakpoint
CREATE INDEX `story_keyframes_segment_idx` ON `story_keyframes` (`segment_id`);--> statement-breakpoint
CREATE INDEX `story_keyframes_shot_idx` ON `story_keyframes` (`shot_id`);--> statement-breakpoint
CREATE INDEX `story_segments_project_idx` ON `story_segments` (`project_id`);--> statement-breakpoint
CREATE INDEX `story_segments_chapter_idx` ON `story_segments` (`project_id`,`chapter_number`);--> statement-breakpoint
CREATE INDEX `story_segments_order_idx` ON `story_segments` (`project_id`,`chapter_number`,`segment_number`);--> statement-breakpoint
CREATE INDEX `story_shots_segment_idx` ON `story_shots` (`segment_id`);--> statement-breakpoint
CREATE INDEX `story_shots_project_idx` ON `story_shots` (`project_id`);--> statement-breakpoint
CREATE INDEX `story_shots_order_idx` ON `story_shots` (`segment_id`,`shot_number`);--> statement-breakpoint
CREATE INDEX `story_video_clips_project_idx` ON `story_video_clips` (`project_id`);--> statement-breakpoint
CREATE INDEX `story_video_clips_keyframe_idx` ON `story_video_clips` (`keyframe_id`);--> statement-breakpoint
CREATE INDEX `story_video_clips_segment_idx` ON `story_video_clips` (`segment_id`);--> statement-breakpoint
CREATE INDEX `story_video_clips_status_idx` ON `story_video_clips` (`project_id`,`status`);