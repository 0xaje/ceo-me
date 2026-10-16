import React from 'react';
import {Composition} from 'remotion';
import {Film} from './Film';
export const Root: React.FC = () => <Composition id="CEO_ME_FILM" component={Film} durationInFrames={2400} fps={30} width={1920} height={1080}/>;
