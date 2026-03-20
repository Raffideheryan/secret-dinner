import { useEffect, useRef, useState, type RefObject } from "react";

type UseInViewResult<T extends Element> = {
    ref: RefObject<T | null>;
    visible: boolean;
};

type UseInViewOptions = IntersectionObserverInit & {
    once?: boolean;
};

export function useInView<T extends Element = HTMLElement>(
    {
        threshold = 0.5,
        root = null,
        rootMargin = "0px 0px -10% 0px",
        once = true,
    }: UseInViewOptions = {}
): UseInViewResult<T> {
    const ref = useRef<T | null>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const element = ref.current;
        if (!element || (visible && once)) {
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setVisible(true);
                    if (once) {
                        observer.disconnect();
                    }
                } else if (!once) {
                    setVisible(false);
                }
            },
            {
                threshold,
                root,
                rootMargin,
            }
        );

        observer.observe(element);

        return () => observer.disconnect();
    }, [visible, threshold, root, rootMargin, once]);

    return { ref, visible };
}
