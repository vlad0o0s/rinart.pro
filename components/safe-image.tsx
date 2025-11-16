"use client";

import Image, { type ImageProps } from "next/image";
import { useMemo, useState, useCallback } from "react";

const PLACEHOLDER_SRC = "/file.svg";

type SafeImageProps = ImageProps & {
	placeholderSrc?: string;
};

export function SafeImage(props: SafeImageProps) {
	const { src, alt, placeholderSrc = PLACEHOLDER_SRC, unoptimized, onError, ...rest } = props;
	const initialSrc = useMemo(() => {
		const value = typeof src === "string" ? src : (Array.isArray(src) ? src[0] : src);
		return value;
	}, [src]);
	const [currentSrc, setCurrentSrc] = useState<ImageProps["src"]>(initialSrc);
	const [forceUnoptimized, setForceUnoptimized] = useState<boolean>(Boolean(unoptimized));

	const handleError = useCallback<NonNullable<ImageProps["onError"]>>(
		(event) => {
			try {
				// Swap to placeholder once to avoid loops
				if (currentSrc !== placeholderSrc) {
					setCurrentSrc(placeholderSrc);
					setForceUnoptimized(true);
				}
			} catch {
				// noop
			}
			if (onError) {
				onError(event);
			}
		},
		[currentSrc, onError, placeholderSrc],
	);

	return <Image src={currentSrc} alt={alt} onError={handleError} unoptimized={forceUnoptimized} {...rest} />;
}

