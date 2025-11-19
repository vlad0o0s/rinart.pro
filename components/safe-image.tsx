"use client";

import Image, { type ImageProps } from "next/image";
import { useMemo, useState, useCallback, useEffect } from "react";

// 1x1 white PNG
const PLACEHOLDER_SRC =
	"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9YkqQ3sAAAAASUVORK5CYII=";

type SafeImageProps = ImageProps & {
	placeholderSrc?: string;
};

export function SafeImage(props: SafeImageProps) {
	const { src, alt, placeholderSrc = PLACEHOLDER_SRC, onError, ...rest } = props;
	const initialSrc = useMemo(() => {
		const value = typeof src === "string" ? src : (Array.isArray(src) ? src[0] : src);
		return value;
	}, [src]);
	const [currentSrc, setCurrentSrc] = useState<ImageProps["src"]>(initialSrc);
	const [hasError, setHasError] = useState(false);
	// Генерируем timestamp только на клиенте после монтирования, чтобы избежать hydration mismatch
	const [cacheBuster, setCacheBuster] = useState<string>("");
	
	useEffect(() => {
		// Генерируем cache buster только на клиенте после монтирования
		setCacheBuster(`t=${Date.now()}`);
	}, []);

	// Обновляем currentSrc при изменении initialSrc и сбрасываем cache buster
	useEffect(() => {
		setCurrentSrc(initialSrc);
		setHasError(false);
		// Обновляем cache buster при изменении src, чтобы загрузить новое изображение
		setCacheBuster(`t=${Date.now()}`);
	}, [initialSrc]);
	
	const isLocal = useMemo(() => {
		const s = typeof initialSrc === "string" ? initialSrc : "";
		// Используем обычный img для всех локальных файлов (начинающихся с /, но не //)
		// Это нужно, так как файлы могут обновляться после билда
		// Пути /uploads/ обрабатываются через API route /app/uploads/[...path]/route.ts
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
		const { 
			width, 
			height, 
			fill, 
			priority, 
			loading, 
			fetchPriority, 
			sizes, 
			unoptimized, 
			placeholder, 
			blurDataURL, 
			quality, 
			loader,
			className,
			style,
			...imgProps 
		} = rest;
		// Добавляем timestamp для обхода кеша браузера, чтобы всегда загружать актуальные файлы
		// Пути /uploads/ обрабатываются через API route /app/uploads/[...path]/route.ts
		// Используем cache buster только после монтирования на клиенте
		const srcWithCache = hasError || !cacheBuster 
			? currentSrc 
			: `${currentSrc}${currentSrc.includes("?") ? "&" : "?"}${cacheBuster}`;
		return (
			<img
				src={srcWithCache}
				alt={alt || ""}
				onError={(e) => {
					// Если файл не загрузился с timestamp, пробуем без него
					if (!hasError && currentSrc !== placeholderSrc) {
						setHasError(true);
						setCurrentSrc(currentSrc);
					} else {
						handleError(e);
					}
				}}
				width={width}
				height={height}
				className={className}
				style={{ objectFit: "cover", width: "100%", height: "100%", ...style }}
				{...imgProps}
			/>
		);
	}

	return <Image src={currentSrc} alt={alt} onError={handleError} unoptimized={true} {...rest} />;
}

