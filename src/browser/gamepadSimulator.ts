import { Direction } from '../shared/types';

let useFakeController = false;
const origGetGamepads = navigator.getGamepads.bind(navigator);

const fakeController = {
  axes: [0, 0, 0, 0],
  buttons: [
    {
      pressed: false,
      touched: false,
      value: 0,
    },
    {
      pressed: false,
      touched: false,
      value: 0,
    },
    {
      pressed: false,
      touched: false,
      value: 0,
    },
    {
      pressed: false,
      touched: false,
      value: 0,
    },
    {
      pressed: false,
      touched: false,
      value: 0,
    },
    {
      pressed: false,
      touched: false,
      value: 0,
    },
    {
      pressed: false,
      touched: false,
      value: 0,
    },
    {
      pressed: false,
      touched: false,
      value: 0,
    },
    {
      pressed: false,
      touched: false,
      value: 0,
    },
    {
      pressed: false,
      touched: false,
      value: 0,
    },
    {
      pressed: false,
      touched: false,
      value: 0,
    },
    {
      pressed: false,
      touched: false,
      value: 0,
    },
    {
      pressed: false,
      touched: false,
      value: 0,
    },
    {
      pressed: false,
      touched: false,
      value: 0,
    },
    {
      pressed: false,
      touched: false,
      value: 0,
    },
    {
      pressed: false,
      touched: false,
      value: 0,
    },
    {
      pressed: false,
      touched: false,
      value: 0,
    },
  ],
  connected: false,
  id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)',
  index: 0,
  mapping: 'standard' as GamepadMappingType,
  timestamp: performance.now(),
  hapticActuators: [],
};

const axeStates: Partial<Record<Direction, boolean>> = {};

const getAxePosForDirection = (direction: Direction) =>
  [Direction.UP, Direction.DOWN].indexOf(direction) > -1 ? 1 : 0;

const getOppositeDirection = (direction: Direction) => {
  switch (direction) {
    case Direction.UP:
      return Direction.DOWN;
    case Direction.DOWN:
      return Direction.UP;
    case Direction.LEFT:
      return Direction.RIGHT;
    case Direction.RIGHT:
      return Direction.LEFT;
  }
};

const getValueForDirection = (direction: Direction) =>
  [Direction.UP, Direction.LEFT].indexOf(direction) > -1 ? -1 : 1;

export function simulateBtnTouch(buttonIndex: number) {
  fakeController.buttons[buttonIndex].touched = true;
  fakeController.timestamp = performance.now();
}

export function simulateBtnPress(buttonIndex: number) {
  fakeController.buttons[buttonIndex].pressed = true;
  fakeController.buttons[buttonIndex].value = 1;
  fakeController.timestamp = performance.now();
}

export function simulateBtnUnpress(buttonIndex: number) {
  fakeController.buttons[buttonIndex].touched = false;
  fakeController.buttons[buttonIndex].pressed = false;
  fakeController.buttons[buttonIndex].value = 0;
  fakeController.timestamp = performance.now();
}

export function simulateBtnAsAxis(buttonIndex: number, value: number) {
  fakeController.buttons[buttonIndex].pressed = true;
  fakeController.buttons[buttonIndex].value = value;
  fakeController.timestamp = performance.now();
}

export function simulateAxeDirPress(axe: number, direction: Direction) {
  axeStates[direction] = true;
  const pos = getAxePosForDirection(direction);
  const value = getValueForDirection(direction);
  const oppositeDirection = getOppositeDirection(direction);
  fakeController.axes[axe * 2 + pos] =
    value + (axeStates[oppositeDirection] ? getValueForDirection(oppositeDirection) : 0);
  fakeController.timestamp = performance.now();
}

export function simulateAxeDirUnpress(axe: number, direction: Direction) {
  axeStates[direction] = false;
  const pos = getAxePosForDirection(direction);
  const oppositeDirection = getOppositeDirection(direction);
  fakeController.axes[axe * 2 + pos] = axeStates[oppositeDirection] ? getValueForDirection(oppositeDirection) : 0;
  fakeController.timestamp = performance.now();
}

export function simulateAxeMove(axe: number, x: number, y: number) {
  fakeController.axes[axe] = x;
  console.debug(y);
  fakeController.timestamp = performance.now();
}

export function simulateGamepadConnect() {
  const event = new Event('gamepadconnected');
  fakeController.connected = true;
  fakeController.timestamp = performance.now();
  (event as any).gamepad = fakeController;
  window.dispatchEvent(event);
}

export function simulateGamepadDisconnect() {
  const event = new Event('gamepaddisconnected');
  fakeController.connected = false;
  fakeController.timestamp = performance.now();
  (event as any).gamepad = fakeController;
  window.dispatchEvent(event);
}

export function modifyGamepadGlobals() {
  navigator.getGamepads = function getGamepads() {
    return useFakeController ? [{ ...fakeController }] : origGetGamepads();
  };
}

export function enableSimulator(enable: boolean) {
  useFakeController = enable;
  if (enable) {
    simulateGamepadConnect();
  } else {
    simulateGamepadDisconnect();
  }
}

export function isEnabled() {
  return useFakeController;
}

export function resetGamepadGlobals() {
  navigator.getGamepads = origGetGamepads;
}

export function getOrigGamepads() {
  return origGetGamepads();
}
