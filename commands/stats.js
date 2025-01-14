const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription("Renvoie les stats de l'utilisateur sélectionné ou celui qui a eu le plus de gaylord")
        .addUserOption(option =>
			option
				.setName('user')
				.setDescription("Le nom de l'utilisateur")
				.setRequired(false)
		)
    ,
    async execute(interaction, targetUser, count, isSpecific) {
        let sentMessage = '';
        if (isSpecific) {
            sentMessage = await interaction.reply(`${targetUser} a pu se faire gaylorder ${count} fois`);
        } else {
            sentMessage = await interaction.reply(`Le plus gros gaylord est ${targetUser} avec ${count} gaylords`);
        }

        setTimeout(async () => {
            try {
                await sentMessage.delete();
                console.log("Message des statistiques supprimé");
            } catch (error) {
                console.error('Impossible de supprimer le message des stats : ', error);
            }
        }, 60000);
    },
};

