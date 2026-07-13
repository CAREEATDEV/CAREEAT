import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';
import App from './App';

registerRootComponent(App);

// Android home-screen widget: register the headless task handler that renders
// and handles taps. No-op on iOS, which uses the native WidgetKit extension.
if (Platform.OS === 'android') {
  const {
    registerWidgetTaskHandler,
  } = require('react-native-android-widget');
  const { widgetTaskHandler } = require('./widget-task-handler');
  registerWidgetTaskHandler(widgetTaskHandler);
}
