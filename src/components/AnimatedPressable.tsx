import React, { useRef, useCallback } from 'react';
import { Animated, Pressable, ViewStyle, StyleProp, StyleSheet } from 'react-native';

interface AnimatedPressableProps {
    onPress?: () => void;
    onLongPress?: () => void;
    style?: StyleProp<ViewStyle>;
    children: React.ReactNode;
    /** Scale to shrink to on press (default 0.95) */
    scaleDown?: number;
    /** Whether the component is disabled */
    disabled?: boolean;
}

export function AnimatedPressable({
    onPress,
    onLongPress,
    style,
    children,
    scaleDown = 0.95,
    disabled = false,
}: AnimatedPressableProps) {
    const scale = useRef(new Animated.Value(1)).current;

    const handlePressIn = useCallback(() => {
        Animated.spring(scale, {
            toValue: scaleDown,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    }, [scale, scaleDown]);

    const handlePressOut = useCallback(() => {
        Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            speed: 18,
            bounciness: 12,
        }).start();
    }, [scale]);

    // Extract flex from style so Pressable wrapper also flexes properly
    const flatStyle = StyleSheet.flatten(style) || {};
    const { flex, flexGrow, flexShrink, flexBasis, alignSelf, ...innerStyle } = flatStyle as ViewStyle;
    const wrapperStyle: ViewStyle = {};
    if (flex !== undefined) wrapperStyle.flex = flex;
    if (flexGrow !== undefined) wrapperStyle.flexGrow = flexGrow;
    if (flexShrink !== undefined) wrapperStyle.flexShrink = flexShrink;
    if (flexBasis !== undefined) wrapperStyle.flexBasis = flexBasis;
    if (alignSelf !== undefined) wrapperStyle.alignSelf = alignSelf;

    return (
        <Pressable
            onPress={onPress}
            onLongPress={onLongPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={disabled}
            style={wrapperStyle}
        >
            <Animated.View style={[innerStyle, { transform: [{ scale }] }]}>
                {children}
            </Animated.View>
        </Pressable>
    );
}

