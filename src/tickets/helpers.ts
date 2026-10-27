import {

	Client,

	TextChannel,

	Guild,

	EmbedBuilder,

	AttachmentBuilder,

	ChannelType,

	PermissionFlagsBits,

	User,

	FileBuilder,

	ContainerBuilder,

	SectionBuilder,

	TextDisplayBuilder,

	ThumbnailBuilder,

	SeparatorBuilder,

	SeparatorSpacingSize,

	MessageFlags,

	codeBlock,

	inlineCode,

} from "discord.js";

import { CONFIG, brandLogoUrl } from "../config";

import { generateTranscript } from "../utils/transcript";

import { buildTicketControlActionRow } from "./views";

import { createLogger } from "../utils/logger";

import {

	createTicket,

	setTicketStatus,

	setTicketCloseReason,

	getTicketByChannel,

} from "./db";



const log = createLogger("ticketHelpers");



export interface TicketClosureOptions {

	channel: TextChannel;

	openerId: string;

	categoryKey: string;

	claimedBy: string | null;

	closedBy: User;

	reason?: string;

}



export async function executeTicketClosure(options: TicketClosureOptions): Promise<void> {

	const { channel, openerId, categoryKey, claimedBy, closedBy, reason = "Automated System Closure" } = options;



	const guild = channel.guild;

	const logChannel = guild.channels.cache.get(String(CONFIG.transcript.channelId)) as TextChannel | undefined;



	const prevTicket = getTicketByChannel(channel.id);

	const wasResolve = prevTicket?.status === "resolve";



	setTicketStatus(channel.id, "close", closedBy.id);

	setTicketCloseReason(channel.id, reason);



	const ticket = getTicketByChannel(channel.id);



	if (logChannel) {

		try {

			const { txtBuffer, htmlBuffer, txtPath, htmlPath } = await generateTranscript(channel, categoryKey);



			const safeName = channel.name.replace(/[^a-z0-9-_]/gi, "_");



			const files: AttachmentBuilder[] = [];

			const fileComponents: FileBuilder[] = [];



			if (txtBuffer) {

				const txtName = `transcript-${safeName}.txt`;



				files.push(

					new AttachmentBuilder(txtBuffer, {

						name: txtName,

					})

				);



				fileComponents.push(new FileBuilder().setURL(`attachment://${txtName}`));

			}



			if (htmlBuffer) {

				const htmlName = `transcript-${safeName}.html`;



				files.push(

					new AttachmentBuilder(htmlBuffer, {

						name: htmlName,

					})

				);



				fileComponents.push(new FileBuilder().setURL(`attachment://${htmlName}`));

			}



			const savedParts: string[] = [];



			if (txtPath) savedParts.push(`\`${txtPath}\``);

			if (htmlPath) savedParts.push(`\`${htmlPath}\``);



			const ticketLabel = channel.name;



			const closedHeader = new SectionBuilder().addTextDisplayComponents(
				new TextDisplayBuilder().setContent("## Ticket Closed")
			);
			const closedLogo = brandLogoUrl();
			if (closedLogo) closedHeader.setThumbnailAccessory(new ThumbnailBuilder().setURL(closedLogo));

			const container = new ContainerBuilder()

				.addSectionComponents(closedHeader)

				.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))

				.addTextDisplayComponents(

					new TextDisplayBuilder().setContent(

						[

							`📇 **Category:** ${categoryKey.toUpperCase()}`,

							`🔒 **Closed By:** ${closedBy}`,

							`👤 **Opened By:** <@${openerId}>`,

							`🛠️ **Handled By:** ${claimedBy ? `<@${claimedBy}>` : "Unassigned"}`,

							"",

							`Reason: ${reason}`,

						].join("\n")

					)

				);



			if (savedParts.length > 0) {

				container

					.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))

					.addTextDisplayComponents(

						new TextDisplayBuilder().setContent(["### Saved Locally", savedParts.join("\n")].join("\n"))

					);

			}



			if (fileComponents.length > 0) {

				container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));



				for (const fileComponent of fileComponents) {

					container.addFileComponents(fileComponent);

				}

			}



			await logChannel.send({

				components: [container],

				files,

				flags: MessageFlags.IsComponentsV2,

			});

		} catch (transcriptError) {

			log.error({ err: transcriptError, channelId: channel.id }, "Failed to generate or send transcript");

		}

	}



	await new Promise((resolve) => setTimeout(resolve, 2000));



	try {

		await channel.delete();

		} catch {

		log.debug({ channelId: channel.id }, "Channel already deleted");

	}

}



export async function createStandardTicket(

	client: Client,

	interaction: any,

	categoryKey: string,

	initialText: string

): Promise<void> {

	const guild = interaction.guild as Guild;

	const categoryConfig = CONFIG.categories[categoryKey];

	const targetCategory = categoryConfig?.id
		? (guild.channels.cache.get(String(categoryConfig.id)) as TextChannel | undefined)
		: undefined;



	if (!categoryConfig?.id || !targetCategory) {

		return interaction.followUp({

			content: "❌ This category has no Discord category yet. An admin needs to run `/config category add` or `/config category edit`.",

			ephemeral: true,

		});

	}



	const targetRoleId = categoryConfig.mentionRole

		? categoryConfig.mentionRole

		: categoryConfig.mgmtOnly

			? CONFIG.roles.mgmtId

			: CONFIG.roles.staffId;

	const targetRole = guild.roles.cache.get(String(targetRoleId));



	const overwrites = [

		{

			id: guild.id,

			allow: [],

			deny: [PermissionFlagsBits.ViewChannel],

		},

		{

			id: interaction.user.id,

			allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],

			deny: [],

		},

		{

			id: client.user?.id ?? "",

			allow: [

				PermissionFlagsBits.ViewChannel,

				PermissionFlagsBits.SendMessages,

				PermissionFlagsBits.ManageChannels,

			],

			deny: [],

		},

	];



	if (targetRole) {

		overwrites.push({

			id: targetRole.id,

			allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],

			deny: [],

		});

	}



	const ticketChannel = await guild.channels.create({

		name: `${categoryKey}-${interaction.user.username}`,

		type: ChannelType.GuildText,

		parent: targetCategory.id,

		permissionOverwrites: overwrites,

	});



	const ticket = createTicket(ticketChannel.id, guild.id, interaction.user.id, categoryKey);

	const ticketNumber = ticket.ticket_id.split("-")[1] ?? "0000";



	await ticketChannel.setName(`${categoryKey.replace(/_/g, "-")}-${ticketNumber}`);

	await ticketChannel.edit({

		topic: `[${ticket.ticket_id}] Claimed by: None | Category: ${categoryKey.toUpperCase()}`,

	});



	const categoryLabel = `${categoryConfig.emoji ?? ""} ${categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1).replace(/_/g, " ")}`;



	const qaFields = initialText

		.split("\n\n")

		.filter(Boolean)

		.map((block) => {

			const lines = block.split("\n");

			const question = lines[0]?.replace(/^\*\*Q:\*\* /, "") ?? "Question";

			const answer = lines.slice(1).join("\n").trim() || "No answer provided.";

			return { name: question.slice(0, 256), value: answer.slice(0, 1024), inline: false };

		});



	const embed = new EmbedBuilder()

		.setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })

		.setTitle(categoryLabel)

		.setDescription(categoryConfig.description)

		.setColor(CONFIG.branding.color)

		.setThumbnail(brandLogoUrl())

		.addFields({ name: "👤 Opened By", value: `${interaction.user}`, inline: true })

		.addFields(...qaFields)

		.setFooter({ text: `${CONFIG.branding.footer} • ${ticket.ticket_id}` })

		.setTimestamp();



	const ping = targetRole ? `<@&${targetRoleId}>` : "";

	await ticketChannel.send({

		content: `${ping} | ${interaction.user}`,

		embeds: [embed],

		components: buildTicketControlActionRow(interaction.user.id, categoryKey, null, "open"),

	});



	await interaction.followUp({

		content: `✅ Ticket created: ${ticketChannel}`,

		ephemeral: true,

	});

}

