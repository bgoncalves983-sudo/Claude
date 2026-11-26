ALTER TABLE `veiculo` ADD `cor` text;--> statement-breakpoint
ALTER TABLE `veiculo` ADD `potencia_kw` integer;--> statement-breakpoint
ALTER TABLE `veiculo` ADD `tara` integer;--> statement-breakpoint
ALTER TABLE `veiculo` ADD `pneus` text;--> statement-breakpoint
ALTER TABLE `veiculo` ADD `tacografo` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `veiculo` ADD `valor_aquisicao` real;--> statement-breakpoint
ALTER TABLE `veiculo` ADD `fornecedor` text;--> statement-breakpoint
ALTER TABLE `veiculo` ADD `cartao_combustivel` text;--> statement-breakpoint
ALTER TABLE `veiculo` ADD `localizacao` text;--> statement-breakpoint
ALTER TABLE `veiculo` ADD `data_abate` text;--> statement-breakpoint
ALTER TABLE `veiculo` ADD `foto_key` text;--> statement-breakpoint
ALTER TABLE `veiculo` ADD `foto_atualizada_em` text;