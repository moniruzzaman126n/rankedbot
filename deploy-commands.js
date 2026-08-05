// Registers the slash commands with Discord.
// Run this once whenever you add/change a command: `npm run deploy-commands`

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

    if (process.env.GUILD_ID) {
      // Guild commands update instantly - best for development/testing.
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: commands }
      );
      console.log(`Registered ${commands.length} commands to guild ${process.env.GUILD_ID}.`);
    } else {
      // Global commands can take up to ~1 hour to propagate.
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands }
      );
      console.log(`Registered ${commands.length} global commands. This can take up to an hour to appear.`);
    }
  } catch (error) {
    console.error('Failed to register commands:', error);
    process.exit(1);
  }
})();
