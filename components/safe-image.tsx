"use client";

import Image, { type ImageProps } from "next/image";
import { useMemo, useState, useCallback } from "react";

// 1x1 white PNG
const PLACEHOLDER_SRC =
	"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9YkqQ3sAAAAASUVORK5CYII=";

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
	const [forceUnoptimized, setForceUnoptimized] = useState<boolean>(() => {
		const s = typeof initialSrc === "string" ? initialSrc : "";
		const isData = s.startsWith("data:");
		const isRemote = /^https?:\/\//i.test(s) || s.startsWith("//");
		// Do not optimize data: or remote images to avoid /_next/image proxy issues in dev/proxies
		return Boolean(unoptimized) || isData || isRemote;
	});

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

