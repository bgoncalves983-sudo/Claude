ALTER TABLE `veiculo` ADD `proprietario` text;--> statement-breakpoint
CREATE INDEX `veiculo_proprietario_idx` ON `veiculo` (`proprietario`);