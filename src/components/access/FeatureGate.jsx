import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { sdk } from "@/api/sdk";
import {
  canAccessFeature,
  getUpgradeMessage,
  getMinimumPlanForFeature,
} from "@/components/utils/permissions";

/**
 * FeatureGate - Redirects to upgrade page if user doesn't have access
 *
 * The props are declared as ONE typedef rather than six loose @param tags.
 * A component's parameter list is a single props object, so the old form told
 * TypeScript the whole object was `hasAccess` -- a boolean -- and every
 * <FeatureGate feature="..."> in the codebase reported as a type error.
 *
 * @typedef {Object} FeatureGateProps
 * @property {boolean} [hasAccess]  bypass the lookup entirely (legacy prop)
 * @property {string} [feature]     feature key checked against the subscription
 * @property {string} [featureName] legacy alias for `feature`
 * @property {string} [title]       display title, used in the upgrade message
 * @property {"redirect"|"blur"} [mode] 'redirect' (default) sends the user to
 *                                  UpgradeRequired; 'blur' just renders nothing
 *                                  and lets the page show its own prompt
 * @property {React.ReactNode} [children] content shown when access is granted
 */

/** @param {FeatureGateProps} props */
export default function FeatureGate({
  hasAccess,
  feature,
  featureName,
  title,
  mode = "redirect",
  children,
}) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      // If hasAccess is explicitly passed, use it
      if (hasAccess !== undefined) {
        setAllowed(hasAccess);
        setLoading(false);
        return;
      }

      // If no feature specified, allow by default
      if (!feature) {
        setAllowed(true);
        setLoading(false);
        return;
      }

      try {
        const user = await sdk.auth.me();

        const subs = await sdk.entities.Subscription.filter({
          user_id: user.id,
        });
        const subscription = subs.length > 0 ? subs[0] : null;

        const hasFeatureAccess = canAccessFeature(subscription, feature);
        setAllowed(hasFeatureAccess);
      } catch (error) {
        console.error("Error checking feature access:", error);
        setAllowed(false);
      }
      setLoading(false);
    };

    checkAccess();
  }, [feature, hasAccess]);

  const featureKey = feature || featureName;

  useEffect(() => {
    // Only redirect if mode is 'redirect' (not 'blur')
    if (!loading && !allowed && featureKey && mode === "redirect") {
      const requiredPlan = getMinimumPlanForFeature(featureKey);
      navigate(createPageUrl("UpgradeRequired"), {
        state: {
          featureName: title || getUpgradeMessage(featureKey),
          requiredPlan,
        },
      });
    }
  }, [allowed, loading, featureKey, title, navigate, mode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-success-600"></div>
      </div>
    );
  }

  if (!allowed) {
    // For blur mode, return null (the page handles showing upgrade prompt)
    // For redirect mode, also return null (redirect happens in useEffect)
    return null;
  }

  return <>{children}</>;
}
