// Register every short here. Copy src/videos/bridge -> src/videos/<name>, rename, and add a <Composition> below.
import React from "react";
import { Composition } from "remotion";
import { BridgeShort, BRIDGE_FRAMES } from "./videos/bridge/Bridge";
import { ScorcherShort, SCORCHER_FRAMES } from "./videos/scorcher/Bridge";
import { WhaleShort, WHALE_FRAMES } from "./videos/whale/Bridge";
import { PigShort, PIG_FRAMES } from "./videos/pigwar/Bridge";
import { ChannelAvatar, ChannelMascot, ChannelBanner } from "./videos/scorcher/channel";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="BridgeShort" component={BridgeShort} durationInFrames={BRIDGE_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="ScorcherShort" component={ScorcherShort} durationInFrames={SCORCHER_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="WhaleShort" component={WhaleShort} durationInFrames={WHALE_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="PigShort" component={PigShort} durationInFrames={PIG_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="ChannelAvatar" component={ChannelAvatar} durationInFrames={1} fps={30} width={1600} height={1600} />
    <Composition id="ChannelMascot" component={ChannelMascot} durationInFrames={1} fps={30} width={1000} height={1600} />
    <Composition id="ChannelBanner" component={ChannelBanner} durationInFrames={1} fps={30} width={2560} height={1440} />
  </>
);
