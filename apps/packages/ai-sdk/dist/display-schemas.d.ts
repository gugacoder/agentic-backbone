import { z } from "zod";
export declare const DisplayMetricSchema: z.ZodObject<{
    label: z.ZodString;
    value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
    unit: z.ZodOptional<z.ZodString>;
    trend: z.ZodOptional<z.ZodObject<{
        direction: z.ZodEnum<{
            up: "up";
            down: "down";
            neutral: "neutral";
        }>;
        value: z.ZodString;
    }, z.core.$strip>>;
    icon: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const DisplayChartSchema: z.ZodObject<{
    type: z.ZodEnum<{
        bar: "bar";
        line: "line";
        pie: "pie";
        area: "area";
        donut: "donut";
    }>;
    title: z.ZodString;
    data: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        value: z.ZodNumber;
        color: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    format: z.ZodOptional<z.ZodObject<{
        prefix: z.ZodOptional<z.ZodString>;
        suffix: z.ZodOptional<z.ZodString>;
        locale: z.ZodDefault<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const DisplayTableSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    columns: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
        type: z.ZodDefault<z.ZodEnum<{
            number: "number";
            link: "link";
            text: "text";
            money: "money";
            image: "image";
            badge: "badge";
        }>>;
        align: z.ZodDefault<z.ZodEnum<{
            left: "left";
            center: "center";
            right: "right";
        }>>;
    }, z.core.$strip>>;
    rows: z.ZodArray<z.ZodRecord<z.core.$ZodRecordKey, z.core.SomeType>>;
    sortable: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export declare const DisplayProgressSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    steps: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        status: z.ZodEnum<{
            pending: "pending";
            completed: "completed";
            current: "current";
        }>;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const DisplayProductSchema: z.ZodObject<{
    title: z.ZodString;
    image: z.ZodOptional<z.ZodString>;
    price: z.ZodOptional<z.ZodObject<{
        value: z.ZodNumber;
        currency: z.ZodDefault<z.ZodString>;
    }, z.core.$strip>>;
    originalPrice: z.ZodOptional<z.ZodObject<{
        value: z.ZodNumber;
        currency: z.ZodDefault<z.ZodString>;
    }, z.core.$strip>>;
    rating: z.ZodOptional<z.ZodObject<{
        score: z.ZodNumber;
        count: z.ZodNumber;
    }, z.core.$strip>>;
    source: z.ZodOptional<z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
        favicon: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    badges: z.ZodOptional<z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        variant: z.ZodDefault<z.ZodEnum<{
            success: "success";
            default: "default";
            error: "error";
            warning: "warning";
            info: "info";
        }>>;
    }, z.core.$strip>>>;
    url: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const DisplayComparisonSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    items: z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        image: z.ZodOptional<z.ZodString>;
        price: z.ZodOptional<z.ZodObject<{
            value: z.ZodNumber;
            currency: z.ZodDefault<z.ZodString>;
        }, z.core.$strip>>;
        originalPrice: z.ZodOptional<z.ZodObject<{
            value: z.ZodNumber;
            currency: z.ZodDefault<z.ZodString>;
        }, z.core.$strip>>;
        rating: z.ZodOptional<z.ZodObject<{
            score: z.ZodNumber;
            count: z.ZodNumber;
        }, z.core.$strip>>;
        source: z.ZodOptional<z.ZodObject<{
            name: z.ZodString;
            url: z.ZodString;
            favicon: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        badges: z.ZodOptional<z.ZodArray<z.ZodObject<{
            label: z.ZodString;
            variant: z.ZodDefault<z.ZodEnum<{
                success: "success";
                default: "default";
                error: "error";
                warning: "warning";
                info: "info";
            }>>;
        }, z.core.$strip>>>;
        url: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    attributes: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const DisplayPriceSchema: z.ZodObject<{
    value: z.ZodObject<{
        value: z.ZodNumber;
        currency: z.ZodDefault<z.ZodString>;
    }, z.core.$strip>;
    label: z.ZodString;
    context: z.ZodOptional<z.ZodString>;
    source: z.ZodOptional<z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
        favicon: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    badge: z.ZodOptional<z.ZodObject<{
        label: z.ZodString;
        variant: z.ZodDefault<z.ZodEnum<{
            success: "success";
            default: "default";
            error: "error";
            warning: "warning";
            info: "info";
        }>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const DisplayImageSchema: z.ZodObject<{
    url: z.ZodString;
    alt: z.ZodOptional<z.ZodString>;
    caption: z.ZodOptional<z.ZodString>;
    width: z.ZodOptional<z.ZodNumber>;
    height: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const DisplayGallerySchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    images: z.ZodArray<z.ZodObject<{
        url: z.ZodString;
        alt: z.ZodOptional<z.ZodString>;
        caption: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    layout: z.ZodDefault<z.ZodEnum<{
        grid: "grid";
        masonry: "masonry";
    }>>;
    columns: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export declare const DisplayCarouselSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    items: z.ZodArray<z.ZodObject<{
        image: z.ZodOptional<z.ZodString>;
        title: z.ZodString;
        subtitle: z.ZodOptional<z.ZodString>;
        price: z.ZodOptional<z.ZodObject<{
            value: z.ZodNumber;
            currency: z.ZodDefault<z.ZodString>;
        }, z.core.$strip>>;
        url: z.ZodOptional<z.ZodString>;
        badges: z.ZodOptional<z.ZodArray<z.ZodObject<{
            label: z.ZodString;
            variant: z.ZodDefault<z.ZodEnum<{
                success: "success";
                default: "default";
                error: "error";
                warning: "warning";
                info: "info";
            }>>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const DisplaySourcesSchema: z.ZodObject<{
    label: z.ZodDefault<z.ZodString>;
    sources: z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        url: z.ZodString;
        favicon: z.ZodOptional<z.ZodString>;
        snippet: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const DisplayLinkSchema: z.ZodObject<{
    url: z.ZodString;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    image: z.ZodOptional<z.ZodString>;
    favicon: z.ZodOptional<z.ZodString>;
    domain: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const DisplayMapSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    pins: z.ZodArray<z.ZodObject<{
        lat: z.ZodNumber;
        lng: z.ZodNumber;
        label: z.ZodOptional<z.ZodString>;
        address: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    zoom: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export declare const DisplayFileSchema: z.ZodObject<{
    name: z.ZodString;
    type: z.ZodString;
    size: z.ZodOptional<z.ZodNumber>;
    url: z.ZodOptional<z.ZodString>;
    preview: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const DisplayCodeSchema: z.ZodObject<{
    language: z.ZodString;
    code: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
    lineNumbers: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export declare const DisplaySpreadsheetSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    headers: z.ZodArray<z.ZodString>;
    rows: z.ZodArray<z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodNull]>>>;
    format: z.ZodOptional<z.ZodObject<{
        moneyColumns: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
        percentColumns: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const DisplayStepsSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    steps: z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        status: z.ZodDefault<z.ZodEnum<{
            pending: "pending";
            completed: "completed";
            current: "current";
        }>>;
    }, z.core.$strip>>;
    orientation: z.ZodDefault<z.ZodEnum<{
        vertical: "vertical";
        horizontal: "horizontal";
    }>>;
}, z.core.$strip>;
export declare const DisplayAlertSchema: z.ZodObject<{
    variant: z.ZodEnum<{
        success: "success";
        error: "error";
        warning: "warning";
        info: "info";
    }>;
    title: z.ZodOptional<z.ZodString>;
    message: z.ZodString;
    icon: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const DisplayChoicesSchema: z.ZodObject<{
    question: z.ZodOptional<z.ZodString>;
    choices: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        icon: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    layout: z.ZodDefault<z.ZodEnum<{
        buttons: "buttons";
        cards: "cards";
        list: "list";
    }>>;
}, z.core.$strip>;
export declare const DisplayToolRegistry: {
    readonly display_metric: z.ZodObject<{
        label: z.ZodString;
        value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
        unit: z.ZodOptional<z.ZodString>;
        trend: z.ZodOptional<z.ZodObject<{
            direction: z.ZodEnum<{
                up: "up";
                down: "down";
                neutral: "neutral";
            }>;
            value: z.ZodString;
        }, z.core.$strip>>;
        icon: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    readonly display_chart: z.ZodObject<{
        type: z.ZodEnum<{
            bar: "bar";
            line: "line";
            pie: "pie";
            area: "area";
            donut: "donut";
        }>;
        title: z.ZodString;
        data: z.ZodArray<z.ZodObject<{
            label: z.ZodString;
            value: z.ZodNumber;
            color: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        format: z.ZodOptional<z.ZodObject<{
            prefix: z.ZodOptional<z.ZodString>;
            suffix: z.ZodOptional<z.ZodString>;
            locale: z.ZodDefault<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    readonly display_table: z.ZodObject<{
        title: z.ZodOptional<z.ZodString>;
        columns: z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodString;
            type: z.ZodDefault<z.ZodEnum<{
                number: "number";
                link: "link";
                text: "text";
                money: "money";
                image: "image";
                badge: "badge";
            }>>;
            align: z.ZodDefault<z.ZodEnum<{
                left: "left";
                center: "center";
                right: "right";
            }>>;
        }, z.core.$strip>>;
        rows: z.ZodArray<z.ZodRecord<z.core.$ZodRecordKey, z.core.SomeType>>;
        sortable: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>;
    readonly display_progress: z.ZodObject<{
        title: z.ZodOptional<z.ZodString>;
        steps: z.ZodArray<z.ZodObject<{
            label: z.ZodString;
            status: z.ZodEnum<{
                pending: "pending";
                completed: "completed";
                current: "current";
            }>;
            description: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    readonly display_product: z.ZodObject<{
        title: z.ZodString;
        image: z.ZodOptional<z.ZodString>;
        price: z.ZodOptional<z.ZodObject<{
            value: z.ZodNumber;
            currency: z.ZodDefault<z.ZodString>;
        }, z.core.$strip>>;
        originalPrice: z.ZodOptional<z.ZodObject<{
            value: z.ZodNumber;
            currency: z.ZodDefault<z.ZodString>;
        }, z.core.$strip>>;
        rating: z.ZodOptional<z.ZodObject<{
            score: z.ZodNumber;
            count: z.ZodNumber;
        }, z.core.$strip>>;
        source: z.ZodOptional<z.ZodObject<{
            name: z.ZodString;
            url: z.ZodString;
            favicon: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        badges: z.ZodOptional<z.ZodArray<z.ZodObject<{
            label: z.ZodString;
            variant: z.ZodDefault<z.ZodEnum<{
                success: "success";
                default: "default";
                error: "error";
                warning: "warning";
                info: "info";
            }>>;
        }, z.core.$strip>>>;
        url: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    readonly display_comparison: z.ZodObject<{
        title: z.ZodOptional<z.ZodString>;
        items: z.ZodArray<z.ZodObject<{
            title: z.ZodString;
            image: z.ZodOptional<z.ZodString>;
            price: z.ZodOptional<z.ZodObject<{
                value: z.ZodNumber;
                currency: z.ZodDefault<z.ZodString>;
            }, z.core.$strip>>;
            originalPrice: z.ZodOptional<z.ZodObject<{
                value: z.ZodNumber;
                currency: z.ZodDefault<z.ZodString>;
            }, z.core.$strip>>;
            rating: z.ZodOptional<z.ZodObject<{
                score: z.ZodNumber;
                count: z.ZodNumber;
            }, z.core.$strip>>;
            source: z.ZodOptional<z.ZodObject<{
                name: z.ZodString;
                url: z.ZodString;
                favicon: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
            badges: z.ZodOptional<z.ZodArray<z.ZodObject<{
                label: z.ZodString;
                variant: z.ZodDefault<z.ZodEnum<{
                    success: "success";
                    default: "default";
                    error: "error";
                    warning: "warning";
                    info: "info";
                }>>;
            }, z.core.$strip>>>;
            url: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        attributes: z.ZodOptional<z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodString;
        }, z.core.$strip>>>;
    }, z.core.$strip>;
    readonly display_price: z.ZodObject<{
        value: z.ZodObject<{
            value: z.ZodNumber;
            currency: z.ZodDefault<z.ZodString>;
        }, z.core.$strip>;
        label: z.ZodString;
        context: z.ZodOptional<z.ZodString>;
        source: z.ZodOptional<z.ZodObject<{
            name: z.ZodString;
            url: z.ZodString;
            favicon: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        badge: z.ZodOptional<z.ZodObject<{
            label: z.ZodString;
            variant: z.ZodDefault<z.ZodEnum<{
                success: "success";
                default: "default";
                error: "error";
                warning: "warning";
                info: "info";
            }>>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    readonly display_image: z.ZodObject<{
        url: z.ZodString;
        alt: z.ZodOptional<z.ZodString>;
        caption: z.ZodOptional<z.ZodString>;
        width: z.ZodOptional<z.ZodNumber>;
        height: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>;
    readonly display_gallery: z.ZodObject<{
        title: z.ZodOptional<z.ZodString>;
        images: z.ZodArray<z.ZodObject<{
            url: z.ZodString;
            alt: z.ZodOptional<z.ZodString>;
            caption: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        layout: z.ZodDefault<z.ZodEnum<{
            grid: "grid";
            masonry: "masonry";
        }>>;
        columns: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>;
    readonly display_carousel: z.ZodObject<{
        title: z.ZodOptional<z.ZodString>;
        items: z.ZodArray<z.ZodObject<{
            image: z.ZodOptional<z.ZodString>;
            title: z.ZodString;
            subtitle: z.ZodOptional<z.ZodString>;
            price: z.ZodOptional<z.ZodObject<{
                value: z.ZodNumber;
                currency: z.ZodDefault<z.ZodString>;
            }, z.core.$strip>>;
            url: z.ZodOptional<z.ZodString>;
            badges: z.ZodOptional<z.ZodArray<z.ZodObject<{
                label: z.ZodString;
                variant: z.ZodDefault<z.ZodEnum<{
                    success: "success";
                    default: "default";
                    error: "error";
                    warning: "warning";
                    info: "info";
                }>>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    readonly display_sources: z.ZodObject<{
        label: z.ZodDefault<z.ZodString>;
        sources: z.ZodArray<z.ZodObject<{
            title: z.ZodString;
            url: z.ZodString;
            favicon: z.ZodOptional<z.ZodString>;
            snippet: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    readonly display_link: z.ZodObject<{
        url: z.ZodString;
        title: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        image: z.ZodOptional<z.ZodString>;
        favicon: z.ZodOptional<z.ZodString>;
        domain: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    readonly display_map: z.ZodObject<{
        title: z.ZodOptional<z.ZodString>;
        pins: z.ZodArray<z.ZodObject<{
            lat: z.ZodNumber;
            lng: z.ZodNumber;
            label: z.ZodOptional<z.ZodString>;
            address: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        zoom: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>;
    readonly display_file: z.ZodObject<{
        name: z.ZodString;
        type: z.ZodString;
        size: z.ZodOptional<z.ZodNumber>;
        url: z.ZodOptional<z.ZodString>;
        preview: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    readonly display_code: z.ZodObject<{
        language: z.ZodString;
        code: z.ZodString;
        title: z.ZodOptional<z.ZodString>;
        lineNumbers: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>;
    readonly display_spreadsheet: z.ZodObject<{
        title: z.ZodOptional<z.ZodString>;
        headers: z.ZodArray<z.ZodString>;
        rows: z.ZodArray<z.ZodArray<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodNull]>>>;
        format: z.ZodOptional<z.ZodObject<{
            moneyColumns: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
            percentColumns: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    readonly display_steps: z.ZodObject<{
        title: z.ZodOptional<z.ZodString>;
        steps: z.ZodArray<z.ZodObject<{
            title: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            status: z.ZodDefault<z.ZodEnum<{
                pending: "pending";
                completed: "completed";
                current: "current";
            }>>;
        }, z.core.$strip>>;
        orientation: z.ZodDefault<z.ZodEnum<{
            vertical: "vertical";
            horizontal: "horizontal";
        }>>;
    }, z.core.$strip>;
    readonly display_alert: z.ZodObject<{
        variant: z.ZodEnum<{
            success: "success";
            error: "error";
            warning: "warning";
            info: "info";
        }>;
        title: z.ZodOptional<z.ZodString>;
        message: z.ZodString;
        icon: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    readonly display_choices: z.ZodObject<{
        question: z.ZodOptional<z.ZodString>;
        choices: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            icon: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        layout: z.ZodDefault<z.ZodEnum<{
            buttons: "buttons";
            cards: "cards";
            list: "list";
        }>>;
    }, z.core.$strip>;
};
export type DisplayToolName = keyof typeof DisplayToolRegistry;
export type DisplayMetric = z.infer<typeof DisplayMetricSchema>;
export type DisplayChart = z.infer<typeof DisplayChartSchema>;
export type DisplayTable = z.infer<typeof DisplayTableSchema>;
export type DisplayProgress = z.infer<typeof DisplayProgressSchema>;
export type DisplayProduct = z.infer<typeof DisplayProductSchema>;
export type DisplayComparison = z.infer<typeof DisplayComparisonSchema>;
export type DisplayPrice = z.infer<typeof DisplayPriceSchema>;
export type DisplayImage = z.infer<typeof DisplayImageSchema>;
export type DisplayGallery = z.infer<typeof DisplayGallerySchema>;
export type DisplayCarousel = z.infer<typeof DisplayCarouselSchema>;
export type DisplaySources = z.infer<typeof DisplaySourcesSchema>;
export type DisplayLink = z.infer<typeof DisplayLinkSchema>;
export type DisplayMap = z.infer<typeof DisplayMapSchema>;
export type DisplayFile = z.infer<typeof DisplayFileSchema>;
export type DisplayCode = z.infer<typeof DisplayCodeSchema>;
export type DisplaySpreadsheet = z.infer<typeof DisplaySpreadsheetSchema>;
export type DisplaySteps = z.infer<typeof DisplayStepsSchema>;
export type DisplayAlert = z.infer<typeof DisplayAlertSchema>;
export type DisplayChoices = z.infer<typeof DisplayChoicesSchema>;
