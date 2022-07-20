import { CodeMap, DEFAULT_SENSITIVITY, isButtonMapping, processGamepadConfig } from '../shared/gamepadConfig';
import { createClickElement, firstClickText, secondClickText } from './dom/clickToEnableMouse';
import {
  enableSimulator,
  getOrigGamepads,
  simulateAxeDirPress,
  simulateAxeDirUnpress,
  simulateAxeMove,
  simulateBtnAsAxis,
  simulateBtnPress,
  simulateBtnUnpress,
} from './gamepadSimulator';
import { Direction, GamepadConfig, StickNum } from '../shared/types';

const listeners = {
  keydown: null as null | EventListener,
  keyup: null as null | EventListener,
  clickToEnableMouse: null as null | ReturnType<typeof createClickElement>,
  pointerlockchange: null as null | EventListener,
  mousemove: null as null | EventListener,
  mousedown: null as null | EventListener,
  mouseup: null as null | EventListener,
  wheel: null as null | EventListener,
};

let flightStick: Gamepad | undefined | null;

let flightStickListener: number, throttleListener: number;

let flightstickPressedButtons: number[] = [];
let throttlePressedButtons: number[] = [];

const getParentElement = () => {
  return document.querySelector("[data-active='ui-container']") || document.body;
};

const mouseLockError = () => {
  if (listeners.clickToEnableMouse) {
    listeners.clickToEnableMouse.text.innerText = secondClickText;
  }
};

function listenMouseMove(axe: StickNum = 1, sensitivity = DEFAULT_SENSITIVITY) {
  let stopMovingTimer: any;
  let needRaf = true; // used for requestAnimationFrame to only trigger at 60fps
  let movementX = 0;
  let movementY = 0;
  const parentElement = getParentElement();
  const handleMouseMove = () => {
    needRaf = true;
    clearTimeout(stopMovingTimer);
    stopMovingTimer = setTimeout(() => {
      simulateAxeMove(axe, 0, 0);
    }, 50);
    // trigger the joystick on move
    const clampedX = movementX === 0 ? 0 : Math.max(Math.min(movementX / sensitivity, 1), -1);
    const clampedY = movementY === 0 ? 0 : Math.max(Math.min(movementY / sensitivity, 1), -1);
    movementX = 0;
    movementY = 0;
    simulateAxeMove(axe, clampedX, clampedY);
  };
  listeners.mousemove = function onMouseMove(e: Event) {
    const { movementX: mx, movementY: my } = e as PointerEvent;
    movementX += mx;
    movementY += my;
    if (needRaf) {
      needRaf = false;
      // Queue processing
      setTimeout(handleMouseMove, 40); // 16 ms = 60 fps, 32 ms = 30 fps
    }
  };
  listeners.pointerlockchange = function onPointerLockChange() {
    if (!listeners.mousemove) return;
    if (document.pointerLockElement) {
      listeners.clickToEnableMouse?.clickElement.remove();
      document.addEventListener('mousemove', listeners.mousemove);
    } else {
      clearTimeout(stopMovingTimer);
      document.removeEventListener('mousemove', listeners.mousemove);
      // show click element again
      listeners.clickToEnableMouse!.text.innerText = firstClickText;
      parentElement.appendChild(listeners.clickToEnableMouse!.clickElement);
    }
  };
  document.addEventListener('pointerlockchange', listeners.pointerlockchange);
  document.addEventListener('pointerlockerror', mouseLockError);
  listeners.clickToEnableMouse = createClickElement();
  parentElement.appendChild(listeners.clickToEnableMouse.clickElement);
  listeners.clickToEnableMouse.clickElement.addEventListener('mousedown', function onClick(e) {
    // Note: make sure the game stream is still in focus or the game will pause input!
    e.preventDefault(); // prevent bluring when clicked
    const req: any = parentElement.requestPointerLock();
    // This shouldn't be needed now with above preventDefault, but just to be safe...
    const doFocus = () => {
      const streamDiv = document.getElementById('game-stream');
      streamDiv?.focus();
    };
    if (req) {
      // Chrome returns a Promise here
      req.then(doFocus).catch(mouseLockError);
    } else {
      doFocus();
    }
  });
}

function listenKeyboard(codeMapping: Record<string, CodeMap>) {
  let stopScrollTimer: any;
  const handleKeyEvent = (
    code: string,
    buttonFn: (index: number) => void,
    axisFn: (axis: number, dir: Direction) => void,
  ) => {
    const mapping = codeMapping[code];
    if (mapping) {
      if (isButtonMapping(mapping)) {
        const { gamepadIndex } = mapping;
        buttonFn(gamepadIndex);
      } else {
        const { axisIndex, axisDirection } = mapping;
        axisFn(axisIndex, axisDirection);
      }
      return true;
    }
    return false;
  };

  listeners.keydown = function keyDown(e) {
    const event = e as KeyboardEvent;
    if (event.repeat) return;
    const handled = handleKeyEvent(event.code, simulateBtnPress, simulateAxeDirPress);
    if (handled && e.cancelable) e.preventDefault();
  };
  listeners.keyup = function keyUp(e) {
    handleKeyEvent((e as KeyboardEvent).code, simulateBtnUnpress, simulateAxeDirUnpress);
  };
  document.addEventListener('keydown', listeners.keydown);
  document.addEventListener('keyup', listeners.keyup);
  if (codeMapping.Click || codeMapping.RightClick) {
    const parentElement = getParentElement();
    listeners.mousedown = function mouseDown(e) {
      const { button } = e as MouseEvent;
      if (button === 0 && codeMapping.Click) {
        handleKeyEvent('Click', simulateBtnPress, simulateAxeDirPress);
      } else if (button === 2 && codeMapping.RightClick) {
        handleKeyEvent('RightClick', simulateBtnPress, simulateAxeDirPress);
      }
    };
    listeners.mouseup = function mouseUp(e) {
      const { button } = e as MouseEvent;
      if (button === 0 && codeMapping.Click) {
        handleKeyEvent('Click', simulateBtnUnpress, simulateAxeDirUnpress);
      } else if (button === 2 && codeMapping.RightClick) {
        handleKeyEvent('RightClick', simulateBtnUnpress, simulateAxeDirUnpress);
      }
    };
    parentElement.addEventListener('mousedown', listeners.mousedown);
    parentElement.addEventListener('mouseup', listeners.mouseup);
  }
  if (codeMapping.Scroll) {
    const parentElement = getParentElement();
    listeners.wheel = function wheel(e) {
      const handled = handleKeyEvent('Scroll', simulateBtnPress, simulateAxeDirPress);
      if (handled) {
        if (e.cancelable) e.preventDefault();
        clearTimeout(stopScrollTimer);
        stopScrollTimer = setTimeout(() => {
          handleKeyEvent('Scroll', simulateBtnUnpress, simulateAxeDirUnpress);
        }, 20);
      }
    };
    parentElement.addEventListener('wheel', listeners.wheel);
  }
}

function unlistenKeyboard() {
  if (listeners.keydown) {
    document.removeEventListener('keydown', listeners.keydown);
  }
  if (listeners.keyup) {
    document.removeEventListener('keyup', listeners.keyup);
  }
  const parentElement = getParentElement();
  if (listeners.mousedown) {
    parentElement.removeEventListener('mousedown', listeners.mousedown);
  }
  if (listeners.mouseup) {
    parentElement.removeEventListener('mouseup', listeners.mouseup);
  }
  if (listeners.wheel) {
    parentElement.removeEventListener('wheel', listeners.wheel);
  }
}

function unlistenMouseMove() {
  document.exitPointerLock();
  listeners.clickToEnableMouse?.clickElement.remove();
}

function unlistenAll() {
  unlistenKeyboard();
  unlistenMouseMove();
}

export function enableConfig(config: GamepadConfig) {
  const { mouseConfig, keyConfig } = config;
  const { codeMapping, invalidButtons, hasErrors } = processGamepadConfig(keyConfig);
  if (hasErrors) {
    // This should have been handled in the Popup UI, but just in case, we print error
    // and still proceed with the part of the config that is valid
    console.error('Invalid button mappings in gamepad config object', invalidButtons);
  }
  unlistenAll();
  listenKeyboard(codeMapping);
  if (mouseConfig.mouseControls !== undefined) {
    listenMouseMove(mouseConfig.mouseControls, mouseConfig.sensitivity);
  }
  enableSimulator(true);
}

export function disableConfig() {
  unlistenAll();
  enableSimulator(false);
}

export function disableHotasConfig() {
  cancelAnimationFrame(flightStickListener);
  cancelAnimationFrame(throttleListener);
  enableSimulator(false);
}

export function enableHotasConfig() {
  enableSimulator(true);
  listenFlightStick();
  listenThrottle();
}

function listenFlightStick() {
  flightStick = getOrigGamepads().find((gamepad) => gamepad?.id.includes('T.16000M'));
  if (flightStick) {
    flightStick.buttons.forEach((btn, index) => {
      if (btn.pressed && !flightstickPressedButtons.includes(index)) {
        simulateBtnPress(index);
        flightstickPressedButtons.push(index);
        return;
      }

      if (!btn.pressed && flightstickPressedButtons.includes(index)) {
        simulateBtnUnpress(index);
        flightstickPressedButtons = flightstickPressedButtons.filter((btn) => btn != index);
        return;
      }
    });

    flightStick.axes.forEach((value, index) => {
      // Leme
      if (index == 5) {
        if (value >= 0.0) {
          simulateBtnAsAxis(6, value);
          simulateBtnAsAxis(7, 0.0);
          return;
        } else {
          simulateBtnAsAxis(7, (value *= -1));
          return;
        }
      }

      // Profundor e Aileron
      if (index == 0 || index == 1) {
        simulateAxeMove(index, value, 0);
        return;
      }

      if (index == 6) {
        simulateAxeMove(3, value, 0);
      }
    });
  }

  flightStickListener = requestAnimationFrame(listenFlightStick);
}

function listenThrottle() {
  const throttle = getOrigGamepads().find((gamepad) => gamepad?.id.includes('TWCS Throttle'));
  if (throttle) {
    throttle.buttons.forEach((btn, index) => {
      if (btn.pressed && !throttlePressedButtons.includes(index)) {
        simulateBtnPress(index);
        throttlePressedButtons.push(index);
        return;
      }

      if (!btn.pressed && throttlePressedButtons.includes(index)) {
        simulateBtnUnpress(index);
        throttlePressedButtons = throttlePressedButtons.filter((btn) => btn != index);
        return;
      }
    });

    throttle.axes.forEach((value, index) => {
      // Potencia
      if (index == 2) {
        simulateAxeMove(index, value, 0);
        return;
      }
    });
  }

  throttleListener = requestAnimationFrame(listenThrottle);
}
