"use client";

import Image, { type ImageProps } from "next/image";
import { buildResponsiveSrcSet } from "@/lib/image-srcset";
import { useMemo, useState, useCallback, useEffect, useLayoutEffect, startTransition } from "react";


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

	// Раньше здесь на каждое монтирование дописывался ?t=<timestamp>. Из-за этого браузер
	// скачивал каждое изображение дважды: сначала по обычному пути при первом рендере,
	// затем повторно с уникальным query после гидратации — вес страницы удваивался.
	// Имена загруженных файлов содержат uuid и меняются при замене фото в админке,
	// поэтому обход кеша не нужен: новый файл — новый URL.

	// Обновляем currentSrc при изменении initialSrc
	useLayoutEffect(() => {
		startTransition(() => {
			setCurrentSrc(initialSrc);
			setHasError(false);
		});
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
		// Извлекаем и игнорируем Next.js-специфичные пропсы, которые не нужны для нативного img
		const {
			width,
			height,
			className,
			style,
			fill: _fill,
			priority,
			loading,
			fetchPriority,
			sizes,
			unoptimized: _unoptimized,
			placeholder: _placeholder,
			blurDataURL: _blurDataURL,
			quality: _quality,
			loader: _loader,
			...imgProps
		} = rest;
		// priority у next/image означает немедленную загрузку — переносим его на нативные атрибуты,
		// иначе loading="lazy" из галерей терялся и все изображения грузились сразу.
		const nativeLoading = priority ? "eager" : (loading ?? "lazy");
		const nativeFetchPriority = fetchPriority ?? (priority ? "high" : undefined);
		// Атрибут sizes без srcset ни на что не влияет: браузер скачивал оригинал (нередко ~1800px)
		// даже в карточку 300x200. Прогоняем локальные файлы через оптимизатор Next и отдаём
		// набор ширин — размер нужного варианта падает в десятки раз.
		const srcSet =
			!hasError && currentSrc !== placeholderSrc ? buildResponsiveSrcSet(currentSrc) : undefined;
		return (
			<img
				src={currentSrc}
				srcSet={srcSet}
				alt={alt || ""}
				onError={handleError}
				width={width}
				height={height}
				loading={nativeLoading}
				fetchPriority={nativeFetchPriority}
				sizes={sizes ?? (srcSet ? "100vw" : undefined)}
				decoding={priority ? "sync" : "async"}
				className={className}
				style={{ objectFit: "cover", width: "100%", height: "100%", ...style }}
				{...imgProps}
			/>
		);
	}

	return <Image src={currentSrc} alt={alt} onError={handleError} unoptimized={true} {...rest} />;
}

