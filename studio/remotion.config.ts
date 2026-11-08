import { Config } from "@remotion/cli/config";
Config.setVideoImageFormat("jpeg");
Config.setChromiumOpenGlRenderer(process.env.REMOTION_GL === "angle" ? "angle" : "swangle");
