const { SlashCommandBuilder, userMention, roleMention } = require("discord.js");
const moment = require("moment")

module.exports = {
	data: new SlashCommandBuilder()
		.setName('gaylord')
		.setDescription('Renvoie le message formaté du nouveau gaylord avec incrémentation et la date')
		.addSubcommand((subcommand) =>
			subcommand
				.setName('add')
				.setDescription("Le nom de l'utilisateur")
				.addUserOption(option =>
					option
						.setName('user')
						.setDescription("Le nom de l'utilisateur")
						.setRequired(true)
				)
				.addStringOption(option =>
					option.setName('message')
						.setDescription("La citation de l'utilisateur")
						.setRequired(true)
				)
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('stats')
				.setDescription("Renvoie les stats de l'utilisateur sélectionné ou celui qui a eu le plus de gaylord")
				.addUserOption(option => option.setName('target').setDescription('The user')))
	,
	async execute(interaction, user, message, role, count) {
		if (interaction.options.getSubcommand() === 'stats') {
			const resStats = `Le plus gros gaylord est ${userMention(user.id)} avec ${count}`;
			await interaction.reply(resStats);
		} else {
			const resGaylord = `Le nouveau ${roleMention(role.id)} : ${userMention(user.id)} n°${count}\n${moment().format("DD/MM/YYYY")} - \"${message}\"`
			await interaction.reply(resGaylord);
		}
	},
};