import { Composition } from "remotion";
import { GettingStarted } from "./compositions/GettingStarted";
import { CLIWalkthrough } from "./compositions/CLIWalkthrough";
import { CLIUsage } from "./compositions/CLIUsage";
import { SessionRecovery } from "./compositions/SessionRecovery";
import { ProviderSetup } from "./compositions/ProviderSetup";
import { TUIBrowser } from "./compositions/TUIBrowser";
import { VIDEO_WIDTH, VIDEO_HEIGHT, VIDEO_FPS } from "./constants";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="GettingStarted"
        component={GettingStarted}
        durationInFrames={35 * VIDEO_FPS}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
      />
      <Composition
        id="CLIWalkthrough"
        component={CLIWalkthrough}
        durationInFrames={47 * VIDEO_FPS}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
      />
      <Composition
        id="CLIUsage"
        component={CLIUsage}
        durationInFrames={60 * VIDEO_FPS}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
      />
      <Composition
        id="SessionRecovery"
        component={SessionRecovery}
        durationInFrames={30 * VIDEO_FPS}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
      />
      <Composition
        id="ProviderSetup"
        component={ProviderSetup}
        durationInFrames={20 * VIDEO_FPS}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
      />
      <Composition
        id="TUIBrowser"
        component={TUIBrowser}
        durationInFrames={20 * VIDEO_FPS}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
      />
    </>
  );
};
