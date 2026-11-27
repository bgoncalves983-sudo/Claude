ALTER TABLE `avaria` ADD `cliente_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `avaria_cliente_id_unique` ON `avaria` (`cliente_id`);