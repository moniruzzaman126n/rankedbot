// Registers the slash commands globally with Discord.
// Run this whenever you add/change a command: `npm run deploy-commands`

require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('rankqueue')
    .setDescription('Join the ranked matchmaking queue (4 players needed).'),

  new SlashCommandBuilder()
    .setName('rankleave')
    .setDescription('Leave the ranked matchmaking queue.'),

  new SlashCommandBuilder()
    .setName('rankabort')
    .setDescription('Cancel the current forming queue. Only the queue captain (or a server admin) can do this.'),

  new SlashCommandBuilder()
    .setName('rankstart')
    .setDescription('Force-start a game with whoever is currently in queue (even if fewer than 4). Captain/admin only.'),

  new SlashCommandBuilder()
    .setName('rankend')
    .setDescription('End the current ranked game. Only the team leader (or a server admin) can do this.'),

  new SlashCommandBuilder()
    .setName('rankfinish')
    .setDescription('Alias for /rankend — end the current ranked game. Team leader or server admin only.'),

  new SlashCommandBuilder()
    .setName('rankstatus')
    .setDescription('Show who is currently in queue or in the active game.'),
].map((command) => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    if (!process.env.CLIENT_ID) {
      throw new Error('CLIENT_ID is missing from your .env file.');
    }

    console.log(`Started refreshing ${commands.length} application (/) commands...`);

    // Global registration - works across ALL servers the bot has joined.
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );

    console.log(`Successfully registered ${commands.length} global commands across Discord.`);
    console.log('Note: Global commands can take up to ~1 hour to appear in all servers.');
  } catch (error) {
    console.error('Failed to register commands:', error);
    process.exit(1);
  }
})();
