const { Client, Events, GatewayIntentBits, MessageFlags, REST, Routes, Collection } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const Sequelize = require('sequelize');
const { token } = require('./config.json');

const sequelize = new Sequelize('database', 'user', 'password', {
	host: 'localhost',
	dialect: 'sqlite',
	logging: false,
	// SQLite only
	storage: 'database.sqlite',
});

const Users = sequelize.define('tags', {
	username: Sequelize.STRING,
	usage_count: {
		type: Sequelize.INTEGER,
		defaultValue: 70,
		allowNull: false,
	},
});

// Create a new client instance
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMessages]
});

const commands = [];

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		if ('data' in command && 'execute' in command) {
			commands.push(command.data.toJSON());
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
	try {
		console.log(`Started refreshing ${commands.length} application (/) commands.`);
		// 
		const data = await rest.put(
			Routes.applicationGuildCommands('1317068960885379102', '1317067517973364836'),
			{ body: commands },
		);

		console.log(`Successfully reloaded ${data.length} application (/) commands.`);
	} catch (error) {
		console.error(error);
	}
})();

const getInteraction = (interaction) => {
	for (const folder of commandFolders) {
		const commandsPath = path.join(foldersPath, folder);
		const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
		for (const file of commandFiles) {
			const filePath = path.join(commandsPath, file);
			const command = require(filePath);
			if (command.commandName === interaction.name) {
				return command;
			} else {
				console.log(`[WARNING] The command at ${filePath} is missing`);
			}
		}
	}
}


client.once(Events.ClientReady, async readyClient => {
	Users.sync();
	// const initUserInfo = await Users.create({
	// 	username: 'Tonton Wick',
	// 	usage_count: 70
	// });
	// console.log(`User added : ${initUserInfo.name} with nbr : ${initUserInfo.usage_count}`);
	console.log(`Ready! Bot: ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
	const user = interaction.options.getMember('user');
    const citation = interaction.options.getString('message');
	const command = getInteraction(interaction);

	const guild = interaction.guild;
	const role = guild.roles.cache.find(role => role.name === 'Gaylord');
	
	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	if (!role) {
		await interaction.reply("Pas de rôle gaylord existant");
	}

	// suppression du role pour tout le monde avant de le mettre à celui qui le mérite
	role.members.forEach((member, i) => {
		member.roles.remove(role);
	})
	
	try {
		await user.roles.add(role);
		await command.execute(interaction, user, citation, role);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
		} else {
			await interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
		}
	}
});

client.login(token);