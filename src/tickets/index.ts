import { Client, TextChannel, ChannelType, EmbedBuilder } from "discord.js";

import { CONFIG } from "../config";

import { executeTicketClosure } from "./helpers";

import {

	handlePanelSelect,

	handleClaimToggleButton,

	handleCloseButton,

} from "./views";

import { handleGenericTicketSubmit } from "./modals";

import { createLogger } from "../utils/logger";

import { hasStaffRole } from "../utils/roles";

import { getTicketByChannel, setTicketStatus } from "./db";

import type { TicketStatus } from "./db";



const log = createLogger("tickets");



export function registerTicketHandlers(client: Client): void {

	client.on("interactionCreate", async (interaction) => {

		if (!interaction.isStringSelectMenu() && !interaction.isButton() && !interaction.isModalSubmit()) return;



		try {

			if (interaction.isStringSelectMenu()) {

				if (interaction.customId === "av:persistent_panel_select") {

					return handlePanelSelect(interaction);

				}

			}



			if (interaction.isButton()) {

				const [prefix, action, ...params] = interaction.customId.split(":");

				if (prefix !== "av") return;



				if (action === "claim_toggle") {

					return handleClaimToggleButton(interaction, params[1], params[2], params[0]);

				}

				if (action === "close_btn") {

					return handleCloseButton(interaction, params[0], params[1]);

				}

			}



			if (interaction.isModalSubmit()) {

				if (interaction.customId.startsWith("av:generic_ticket:")) {

					return handleGenericTicketSubmit(interaction);

				}

			}

		} catch (error) {

			log.error({ err: error, customId: interaction.customId }, "Ticket interaction failed");

			try {

				if (!interaction.replied && !interaction.deferred) {

					await interaction.reply({

						content: "❌ An unexpected error occurred.",

						ephemeral: true,

					});

				} else {

					await interaction.editReply({ content: "❌ An unexpected error occurred." });

				}

			} catch {

				log.debug("Failed to send error reply for ticket interaction");

			}

		}

	});

}

