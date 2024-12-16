const { SlashCommandBuilder, userMention, roleMention } = require("discord.js");
const moment = require("moment")

module.exports = {
	data: new SlashCommandBuilder()
		.setName('gaylord')
		.setDescription('Renvoie le message formaté du nouveau gaylord avec incrémentation et la date')
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
		),
	async execute(interaction, user, message, role) {
		
		const stringB = `Le nouveau ${roleMention(role.id)} : ${userMention(user.id)} n°01\n${moment().format("DD/MM/YYYY")} - \"${message}\"`
		await interaction.reply(stringB);
	},
};