import { disableConfig, enableHotasConfig } from './browser/browserEventProcessor';
import { showToast } from './browser/dom/snackbar';
import { modifyGamepadGlobals, isEnabled as gamepadSimulatorIsEnabled } from './browser/gamepadSimulator';
import { gameChanged, intializedMsg, Message, MessageTypes } from './shared/messages';
import { GamepadConfig } from './shared/types';

/*
 * This script is injected and run inside the browser page itself and thus
 * has no "isolated world" or sandboxing.
 * It uses window.postMessage to communicate with the content_script.
 */

modifyGamepadGlobals();

let interval: ReturnType<typeof setInterval>;

function postMessageToWindow(msg: any) {
  window.postMessage({ ...msg, source: 'xcloud-page' });
}

function getGameNameFromXboxPage(): string | null {
  let gameName: string | null = null;
  // e.g. "Halo Infinite | Xbox Cloud Gaming (Beta) on Xbox.com"
  const titleSplit = document.title.split(/\s+\|/);
  if (titleSplit.length === 2) {
    gameName = titleSplit[0];
  }
  return gameName || null;
}

function checkIfInGame() {
  // Headings only shown when there are errors or need sign in
  const isXbox = window.location.href.indexOf('xbox.com') !== -1;
  let isInGame = !isXbox;
  if (isXbox) {
    const h1 = document.querySelector('h1');
    const closeBtn = document.querySelector("[data-id='ui-container'] [aria-label='Close']");
    const streamDiv = document.getElementById('game-stream');
    isInGame = !h1 && !closeBtn && !!streamDiv;
  }
  return {
    isInGame,
    isXbox,
    gameName: isInGame && true ? getGameNameFromXboxPage() : null,
  };
}

function handleDisableGamepad() {
  // Disable the fake gamepad and let them use their real gamepad
  if (gamepadSimulatorIsEnabled()) {
    showToast('Mouse/keyboard disabled');
  }
  disableConfig();
}

function handleGamepadConfigUpdate(name: string, config: GamepadConfig) {
  showToast(`'${name}' preset activated`);
  console.debug(config);
  enableHotasConfig();
}

function connectToExtension(gameName: string | null) {
  // Setting up connection to content script via postMessage
  postMessageToWindow(intializedMsg(gameName));

  window.addEventListener('message', (event) => {
    if (event.source != window || event.data.source !== 'xcloud-keyboard-mouse-content-script') {
      // We only accept messages from ourselves
      return;
    }
    const msg: Message = event.data;
    // Got message from extension
    if (msg.type === MessageTypes.ACTIVATE_GAMEPAD_CONFIG) {
      handleGamepadConfigUpdate(msg.name, msg.gamepadConfig);
    } else if (msg.type === MessageTypes.DISABLE_GAMEPAD) {
      handleDisableGamepad();
    }
  });

  // Periodically check if user leaves the game
  clearInterval(interval);
  interval = setInterval(() => {
    const { isInGame } = checkIfInGame();
    if (!isInGame) {
      clearInterval(interval);
      // The user is no longer playing a game, so disable the virtual gamepad
      handleDisableGamepad();
      postMessageToWindow(gameChanged(null));
      // Begin listening again for a game to start
      waitForActiveGame();
    }
  }, 1000);
}

function waitForActiveGame() {
  // Periodically check if user enters a game
  clearInterval(interval);
  interval = setInterval(() => {
    const { isInGame, gameName } = checkIfInGame();
    if (isInGame) {
      clearInterval(interval);
      connectToExtension(gameName);
    }
  }, 1000);
}

// We need to use 'pageshow' here instead of 'load' because the 'load' event
// doesn't always trigger if the page is cached (e.g. pressing the back button)
window.addEventListener('pageshow', waitForActiveGame, false);
// Not sure yet if this is needed:
// win.addEventListener('popstate', onLoad, false);
