const { Client, Events, GatewayIntentBits, MessageFlags, REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const Sequelize = require('sequelize');

const dotenv = require('dotenv');
dotenv.config();

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
	date: Sequelize.DATE
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

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
	try {
		console.log(`Started refreshing ${commands.length} application (/) commands.`);
		// mettre les values dans le .env
		const data = await rest.put(
			Routes.applicationCommands('1317068960885379102', '1317067517973364836'),
			{ body: commands },
		);
		console.log("Init database");
		Users.sync();
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
	// on remplit la base avec les anciens messages
	const oldMessages = [];
	const channel = client.channels.cache.get(process.env.DISCORD_CHANNEL);

	console.log("Récupération des anciens messages");
	const messages = await channel.messages.fetch({ limit: 100 })
	console.log(`Received ${messages.size} messages`);
	messages.forEach(message => {
		if (message.content.includes("n°")) {
			oldMessages.push(message);
		}
	})

	const res = await Users.findAll();

	console.log("Init de la base de données pour stocker les data");
	if (!res && oldMessages) {
		console.log("Add all old messages")
		oldMessages.forEach(async message => {
			const regex = /@([^@]+) n°/;
			const match = message.content.match(regex);
			if (match) {
				const usernameRegex = match[1];
				const username = client.users.cache.get(usernameRegex.slice(0, -1)).globalName;
				const index = message.content.indexOf("n°");
				const char = "n°";
				//TODO: maybe find next characters until space...
				const count = message.content.slice(index + char.length, index + char.length + 3).trim();
				await Users.create({
					username: username,
					usage_count: count
				})
			}
		});
	}
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
	if (interaction.options._subcommand === 'stats') {
		const res = await Users.findAll({
			attributes: [
				'username',
				[Sequelize.fn('COUNT', Sequelize.col('username')), 'roleCount']
			],
			group: ['username'],
			limit: 1
		})
		console.log("res", res);
		await command.execute(interaction, "toto", null, null, 0);
	} else {
		if (!role) {
			await interaction.reply("Pas de rôle gaylord existant");
		}

		// suppression du role pour tout le monde avant de le mettre à celui qui le mérite
		role.members.forEach((member, i) => {
			member.roles.remove(role);
		})

		try {
			await user.roles.add(role);
			// get all gaylords and order by usage count asc
			const res = await Users.findAll({ order: [['usage_count', 'ASC']] });
			const lastElement = res[res.length - 1];
			const newUser = await Users.create({
				username: user.user.globalName,
				usage_count: lastElement.usage_count + 1
			});
			console.log("Add new user");
			await command.execute(interaction, user, citation, role, newUser.usage_count);
		} catch (error) {
			console.error(error);
			if (interaction.replied || interaction.deferred) {
				await interaction.followUp({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
			} else {
				await interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
			}
		}
	}
});

client.login(process.env.DISCORD_TOKEN);