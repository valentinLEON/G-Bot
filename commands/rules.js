const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rules')
        .setDescription("Renvoie les règles pour attributer le gaylord")
    ,
    async execute(interaction) {
        // Création de l'embed
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`Règles pour attributer le gaylord`)
            // .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: 'Règle 1', value: "Dire quelque chose qui permettra de le prendre", inline: true },
                { name: 'Règle 2', value: "Le demander directement", inline: false },
                { name: 'Règle 3', value: "Avoir Taric en ARAM (sauf en le choisissant ou en demandant un roll à quelqu'un et avoir Taric)", inline: false },
                { name: 'Règle 4', value: "Demander de mettre le Gaylord à l'actuel Gaylord", inline: false },
            )
            .setTimestamp();

        // Envoi de l'embed
        await interaction.reply({ embeds: [embed] });
    },
};
