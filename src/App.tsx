import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { AuthLayout } from "./components/AuthLayout";
import {
  CompleteProfileRoute,
  GuestRoute,
  ProtectedRoute,
  SetPasswordRoute,
} from "./components/ProtectedRoute";
import { AccountSuccessPage } from "./pages/AccountSuccessPage";
import { ChatsPage, ChatSelectEmpty } from "./pages/ChatsPage";
import { ChatThreadPage } from "./pages/ChatThreadPage";
import { ArchivedChatsPage } from "./pages/ArchivedChatsPage";
import { CompleteProfilePage } from "./pages/CompleteProfilePage";
import { ErrandsPage, ErrandSelectEmpty } from "./pages/ErrandsPage";
import { ErrandDetailPage } from "./pages/ErrandDetailPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { GetAppPage } from "./pages/GetAppPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { ProfilePage, ProfileSelectEmpty } from "./pages/ProfilePage";
import { AboutPage } from "./pages/profile/AboutPage";
import { AccountSecurityPage } from "./pages/profile/AccountSecurityPage";
import { HelpSupportPage } from "./pages/profile/HelpSupportPage";
import { NotificationSettingsPage } from "./pages/profile/NotificationSettingsPage";
import { PaymentMethodsPage } from "./pages/profile/PaymentMethodsPage";
import { PersonalInfoPage } from "./pages/profile/PersonalInfoPage";
import { SetPasswordPage } from "./pages/SetPasswordPage";
import { NewErrandPage } from "./pages/NewErrandPage";
import { WalletPage } from "./pages/WalletPage";
import { SignupPage } from "./pages/SignupPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/account-success" element={<AccountSuccessPage />} />
        </Route>

        <Route element={<SetPasswordRoute />}>
          <Route path="/set-password" element={<SetPasswordPage />} />
        </Route>

        <Route element={<CompleteProfileRoute />}>
          <Route path="/complete-profile" element={<CompleteProfilePage />} />
        </Route>

        <Route path="/get-app" element={<GetAppPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/errands/new" element={<NewErrandPage />} />
          <Route path="/errands" element={<ErrandsPage />}>
            <Route index element={<ErrandSelectEmpty />} />
            <Route path=":errandId" element={<ErrandDetailPage />} />
          </Route>
          <Route path="/chats/archived" element={<ArchivedChatsPage />} />
          <Route path="/chats" element={<ChatsPage />}>
            <Route index element={<ChatSelectEmpty />} />
            <Route path=":threadId" element={<ChatThreadPage />} />
          </Route>
          <Route path="/profile" element={<ProfilePage />}>
            <Route index element={<ProfileSelectEmpty />} />
            <Route path="personal" element={<PersonalInfoPage />} />
            <Route path="security" element={<AccountSecurityPage />} />
            <Route path="notifications" element={<NotificationSettingsPage />} />
            <Route path="payments" element={<PaymentMethodsPage />} />
            <Route path="help" element={<HelpSupportPage />} />
            <Route path="about" element={<AboutPage />} />
          </Route>
          <Route path="/notifications" element={<NotificationsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
