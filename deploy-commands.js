// deploy-commands.js
require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('rankqueue')
    .setDescription('Join the ranked matchmaking queue (4 players needed).'),

  new SlashCommandBuilder()
    .setName('rankq')
    .setDescription('Alias for /rankqueue — join the queue.'),

  new SlashCommandBuilder()
    .setName('rankleave')
    .setDescription('Leave the ranked matchmaking queue.'),

  new SlashCommandBuilder()
    .setName('rankabort')
    .setDescription('Cancel the current forming queue. Captain/admin only.'),

  new SlashCommandBuilder()
    .setName('rankstart')
    .setDescription('Force-start a game with whoever is currently in queue. Captain/admin only.'),

  new SlashCommandBuilder()
    .setName('rankend')
    .setDescription('End the current ranked game. Team leader/admin only.'),

  new SlashCommandBuilder()
    .setName('rankfinish')
    .setDescription('Alias for /rankend — end the current ranked game.'),

  new SlashCommandBuilder()
    .setName('rankstatus')
    .setDescription('Show who is currently in queue or in the active game.'),

  new SlashCommandBuilder()
    .setName('rankremove')
    .setDescription('Remove a player from the queue. Captain/admin only.')
    .addUserOption((option) =>
      option
        .setName('target')
        .setDescription('The user to remove from queue')
        .setRequired(true)
    ),
].map((command) => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

module.exports = async function deployCommands() {
  try {
    if (!process.env.CLIENT_ID) {
      throw new Error('CLIENT_ID is missing from environment variables.');
    }

    console.log('--- PURGING ALL OLD COMMANDS ---');

    // 1. Wipe Guild-specific commands if GUILD_ID exists in .env
    if (process.env.GUILD_ID) {
      console.log('Purging Guild-specific commands...');
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: [] }
      );
      console.log('Wiped Guild commands.');
    }

    // 2. Wipe Global commands
    console.log('Purging Global commands...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: [] }
    );
    console.log('Wiped Global commands.');

    // 3. Register fresh commands globally
    console.log(`Registering ${commands.length} fresh global commands...`);
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log('Fresh global commands successfully registered!');

  } catch (error) {
    console.error('Failed to deploy commands:', error);
  }
};
