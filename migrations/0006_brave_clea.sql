CREATE TABLE `push_subscricao` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`utilizador_id` integer NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`dispositivo` text,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL,
	FOREIGN KEY (`utilizador_id`) REFERENCES `utilizador`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscricao_endpoint_unique` ON `push_subscricao` (`endpoint`);--> statement-breakpoint
CREATE INDEX `push_utilizador_idx` ON `push_subscricao` (`utilizador_id`);