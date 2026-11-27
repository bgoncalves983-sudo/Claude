CREATE TABLE `avaria_foto` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`avaria_id` integer NOT NULL,
	`veiculo_id` integer NOT NULL,
	`grande_key` text NOT NULL,
	`mini_key` text NOT NULL,
	`utilizador_id` integer,
	`cliente_id` text,
	`criado_em` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')) NOT NULL,
	FOREIGN KEY (`avaria_id`) REFERENCES `avaria`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`veiculo_id`) REFERENCES `veiculo`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`utilizador_id`) REFERENCES `utilizador`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `avaria_foto_cliente_id_unique` ON `avaria_foto` (`cliente_id`);--> statement-breakpoint
CREATE INDEX `avaria_foto_avaria_idx` ON `avaria_foto` (`avaria_id`);