require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Events,
  EmbedBuilder,
  PermissionsBitField,
} = require('discord.js');
const deployCommands = require('./deploy-commands.js');

// ---- Config -----------------------------------------------------------
const MAX_PLAYERS = 4;        // team size that triggers an auto-start
const MIN_FORCE_START = 2;    // minimum players required for /rankstart
const QUEUE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes timeout per player

// ---- In-memory state ----------------------------------------------------
const guildStates = new Map();

function getState(guildId) {
  if (!guildStates.has(guildId)) {
    guildStates.set(guildId, { queue: [], queueCaptainId: null, activeGame: null });
  }
  return guildStates.get(guildId);
}

function playerList(players) {
  return players.map((p) => `• <@${p.id}>`).join('\n');
}

function isAdmin(interaction) {
  return interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild) ?? false;
}

function isCaptainOrAdmin(interaction, captainId) {
  return interaction.user.id === captainId || isAdmin(interaction);
}

// ---- Client setup ---------------------------------------------------------
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, async (c) => {
  console.log(`Logged in as ${c.user.tag}. Ready to manage ranked queues.`);

  // Automatically register global slash commands on bot startup
  try {
    await deployCommands();
  } catch (err) {
    console.error('Failed to execute deployCommands on startup:', err);
  }
});

// ---- Helper: start a game from a list of players ---------------------
async function startGame(interaction, state, players, leaderId) {
  // Clear any existing timers on these starting players
  players.forEach((p) => p.timer && clearTimeout(p.timer));

  state.activeGame = {
    players,
    leaderId,
    startedAt: Date.now(),
  };
  state.queue = [];
  state.queueCaptainId = null;

  const embed = new EmbedBuilder()
    .setTitle(' Ranked game starting!')
    .setDescription(playerList(players))
    .addFields({ name: 'Team Leader', value: `<@${leaderId}>` })
    .setFooter({ text: 'The team leader (or an admin) can run /rankend when the game is over.' })
    .setColor(0x57f287)
    .setTimestamp();

  await interaction.channel.send({ content: '@here A ranked game has started!', embeds: [embed] });
}

// ---- Interaction handling ----------------------------------------------
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (!interaction.guildId) {
    await interaction.reply({ content: 'This bot only works inside a server.', ephemeral: true });
    return;
  }

  const state = getState(interaction.guildId);
  const user = interaction.user;

  switch (interaction.commandName) {
    case 'rankadd':    
    case 'ranka':
    case 'rankqueue': {
      if (state.activeGame) {
        await interaction.reply({
          content: 'A ranked game is already in progress.',
          ephemeral: true,
        });
        return;
      }

      if (state.queue.some((p) => p.id === user.id)) {
        await interaction.reply({
          content: `You're already in queue (${state.queue.length}/${MAX_PLAYERS}).`,
          ephemeral: true,
        });
        return;
      }

      const isFirstToJoin = state.queue.length === 0;

      // Set timeout timer for this specific user
      const timeoutTimer = setTimeout(async () => {
        const currentIdx = state.queue.findIndex((p) => p.id === user.id);
        if (currentIdx !== -1) {
          const wasCaptain = state.queueCaptainId === user.id;
          state.queue.splice(currentIdx, 1);

          let captainNote = '';
          if (wasCaptain) {
            if (state.queue.length > 0) {
              state.queueCaptainId = state.queue[0].id;
              captainNote = ` <@${state.queueCaptainId}> is now the captain.`;
            } else {
              state.queueCaptainId = null;
            }
          }

          // Send notification to the channel that the user timed out
          await interaction.channel.send({
            content: ` <@${user.id}> was removed from the queue due to inactivity (${state.queue.length}/${MAX_PLAYERS}).${captainNote}`,
          });
        }
      }, QUEUE_TIMEOUT_MS);

      state.queue.push({ id: user.id, tag: user.tag, timer: timeoutTimer });

      if (isFirstToJoin) {
        state.queueCaptainId = user.id;
      }

      if (state.queue.length < MAX_PLAYERS) {
        await interaction.reply({
          content: [
            ` <@${user.id}> joined the ranked queue (${state.queue.length}/${MAX_PLAYERS}).`,
            ` Captain: <@${state.queueCaptainId}>`,
            playerList(state.queue),
          ].join('\n'),
        });
        return;
      }

      // Queue is full: clear all pending timers before starting the game
      state.queue.forEach((p) => clearTimeout(p.timer));

      const players = state.queue.splice(0, MAX_PLAYERS);
      const leaderId = state.queueCaptainId;
      await interaction.reply({ content: ` <@${user.id}> joined. Queue is full — starting the game!` });
      await startGame(interaction, state, players, leaderId);
      return;
    }

    case 'rankleave': {
      const idx = state.queue.findIndex((p) => p.id === user.id);
      if (idx === -1) {
        await interaction.reply({ content: "You're not in the queue.", ephemeral: true });
        return;
      }

      const wasCaptain = state.queueCaptainId === user.id;
      const [removed] = state.queue.splice(idx, 1);
      if (removed.timer) clearTimeout(removed.timer); // Clear timeout

      let captainNote = '';
      if (wasCaptain) {
        if (state.queue.length > 0) {
          state.queueCaptainId = state.queue[0].id;
          captainNote = `\n <@${state.queueCaptainId}> is now the captain.`;
        } else {
          state.queueCaptainId = null;
        }
      }

      await interaction.reply({
        content: ` <@${user.id}> left the queue (${state.queue.length}/${MAX_PLAYERS}).${captainNote}`,
      });
      return;
    }

    case 'rankabort': {
      if (state.activeGame) {
        await interaction.reply({
          content: 'A game is already in progress — use `/rankend` to finish it instead.',
          ephemeral: true,
        });
        return;
      }

      if (state.queue.length === 0) {
        await interaction.reply({ content: 'There is no queue to abort.', ephemeral: true });
        return;
      }

      if (!isCaptainOrAdmin(interaction, state.queueCaptainId)) {
        await interaction.reply({
          content: `Only the queue captain (<@${state.queueCaptainId}>) or a server admin can abort the queue.`,
          ephemeral: true,
        });
        return;
      }

      state.queue.forEach((p) => p.timer && clearTimeout(p.timer)); // Clear timeouts
      state.queue = [];
      state.queueCaptainId = null;

      await interaction.reply({ content: ` <@${user.id}> aborted the queue. Use \`/rankqueue\` to start a new one.` });
      return;
    }

    case 'rankstart': {
      if (state.activeGame) {
        await interaction.reply({
          content: 'A ranked game is already in progress.',
          ephemeral: true,
        });
        return;
      }

      if (state.queue.length < MIN_FORCE_START) {
        await interaction.reply({
          content: `Not enough players to force-start. Need at least ${MIN_FORCE_START}, currently have ${state.queue.length}.`,
          ephemeral: true,
        });
        return;
      }

      if (!isCaptainOrAdmin(interaction, state.queueCaptainId)) {
        await interaction.reply({
          content: `Only the queue captain (<@${state.queueCaptainId}>) or a server admin can force-start.`,
          ephemeral: true,
        });
        return;
      }

      const players = state.queue.splice(0, MAX_PLAYERS);
      const leaderId = players.some((p) => p.id === state.queueCaptainId)
        ? state.queueCaptainId
        : user.id;

      await interaction.reply({ content: ` <@${user.id}> force-started the game with ${players.length} player(s).` });
      await startGame(interaction, state, players, leaderId);
      return;
    }

    case 'rankend':
    case 'rankfinish': {
      if (!state.activeGame) {
        await interaction.reply({ content: 'There is no active ranked game right now.', ephemeral: true });
        return;
      }

      if (!isCaptainOrAdmin(interaction, state.activeGame.leaderId)) {
        await interaction.reply({
          content: `Only the team leader (<@${state.activeGame.leaderId}>) or a server admin can end this game.`,
          ephemeral: true,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(' Ranked game ended')
        .setDescription(`Ended by <@${user.id}>. Thanks for playing!\nQueue is open again — use \`/rankqueue\` to join the next game.`)
        .setColor(0xed4245)
        .setTimestamp();

      state.activeGame = null;

      await interaction.reply({ embeds: [embed] });
      return;
    }

    case 'rankremove': {
      if (state.activeGame) {
        await interaction.reply({
          content: 'A game is already in progress — use `/rankend` to finish it instead.',
          ephemeral: true,
        });
        return;
      }

      if (state.queue.length === 0) {
        await interaction.reply({ content: 'The queue is currently empty.', ephemeral: true });
        return;
      }

      if (!isCaptainOrAdmin(interaction, state.queueCaptainId)) {
        await interaction.reply({
          content: `Only the queue captain (<@${state.queueCaptainId}>) or a server admin can remove players.`,
          ephemeral: true,
        });
        return;
      }

      const targetUser = interaction.options.getUser('target');
      const idx = state.queue.findIndex((p) => p.id === targetUser.id);

      if (idx === -1) {
        await interaction.reply({
          content: `<@${targetUser.id}> is not in the queue.`,
          ephemeral: true,
        });
        return;
      }

      const wasCaptain = state.queueCaptainId === targetUser.id;
      const [removed] = state.queue.splice(idx, 1);
      if (removed.timer) clearTimeout(removed.timer); // Clear timeout

      let captainNote = '';
      if (wasCaptain) {
        if (state.queue.length > 0) {
          state.queueCaptainId = state.queue[0].id;
          captainNote = `\n <@${state.queueCaptainId}> is now the captain.`;
        } else {
          state.queueCaptainId = null;
        }
      }

      await interaction.reply({
        content: ` <@${user.id}> removed <@${targetUser.id}> from the queue (${state.queue.length}/${MAX_PLAYERS}).${captainNote}`,
      });
      return;
    }

    case 'rankstatus': {
      const embed = new EmbedBuilder().setTitle(' Ranked Queue Status').setColor(0x5865f2);

      if (state.activeGame) {
        embed.addFields(
          { name: 'Status', value: 'Game in progress' },
          { name: 'Team', value: playerList(state.activeGame.players) },
          { name: 'Leader', value: `<@${state.activeGame.leaderId}>` }
        );
      } else if (state.queue.length === 0) {
        embed.setDescription('The queue is empty. Use `/rankqueue` to join (and become captain).');
      } else {
        embed.addFields(
          { name: 'Status', value: `Waiting (${state.queue.length}/${MAX_PLAYERS})` },
          { name: 'Captain', value: `<@${state.queueCaptainId}>` },
          { name: 'Players', value: playerList(state.queue) }
        );
      }

      await interaction.reply({ embeds: [embed] });
      return;
    }

    default:
      await interaction.reply({ content: 'Unknown command.', ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);

if (process.env.PORT) {
  const express = require('express');
  const app = express();
  app.get('/', (req, res) => res.send('Rank queue bot is alive.'));
  app.listen(process.env.PORT, () => {
    console.log(`Keep-alive web server listening on port ${process.env.PORT}`);
  });
}
