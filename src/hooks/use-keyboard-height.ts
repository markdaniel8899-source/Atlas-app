import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * Live on-screen keyboard height. Android is edge-to-edge (the IME overlays
 * the window instead of resizing it), so scrollable screens pad their content
 * by this value to keep focused fields and actions reachable.
 */
export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const show = Keyboard.addListener(showEvent, (event) => {
      setHeight(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
