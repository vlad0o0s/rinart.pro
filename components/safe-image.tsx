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
	const [hasError, setHasError] = useState(false);
	
	const isLocal = useMemo(() => {
		const s = typeof initialSrc === "string" ? initialSrc : "";
		// Используем обычный img для всех локальных файлов (начинающихся с /, но не //)
		// Это нужно, так как файлы могут обновляться после билда
		return s.startsWith("/") && !s.startsWith("//");
	}, [initialSrc]);

	const handleError = useCallback<NonNullable<ImageProps["onError"]>>(
		(event) => {
			try {
				// Swap to placeholder once to avoid loops
				if (!hasError) {
					setHasError(true);
					setCurrentSrc(placeholderSrc);
				}
			} catch {
				// noop
			}
			if (onError) {
				onError(event);
			}
		},
		[hasError, onError, placeholderSrc],
	);

	// Для локальных файлов используем обычный img, чтобы избежать проблем с Next.js Image оптимизацией
	if (isLocal && typeof currentSrc === "string") {
		const { width, height, ...imgProps } = rest;
		// Добавляем timestamp для обхода кеша, если файл не загружается
		const srcWithCache = hasError ? currentSrc : `${currentSrc}${currentSrc.includes("?") ? "&" : "?"}t=${Date.now()}`;
		return (
			<img
				src={hasError ? currentSrc : srcWithCache}
				alt={alt || ""}
				onError={(e) => {
					// Если файл не загрузился, пробуем без timestamp
					if (!hasError && currentSrc !== placeholderSrc) {
						setHasError(true);
						setCurrentSrc(currentSrc);
					} else {
						handleError(e);
					}
				}}
				width={width}
				height={height}
				style={{ objectFit: "cover", width: "100%", height: "100%" }}
				{...imgProps}
			/>
		);
	}

	return <Image src={currentSrc} alt={alt} onError={handleError} unoptimized={true} {...rest} />;
}

