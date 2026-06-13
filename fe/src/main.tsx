import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from "react-router-dom";
import { Feed } from "./features/feed/pages/Feed/Feed";
import { Login } from "./features/authentication/pages/Login/Login";
import { Signup } from "./features/authentication/pages/Signup/Signup";
import { ResetPassword } from "./features/authentication/pages/ResetPassword/ResetPassword";
import { VerifyEmail } from "./features/authentication/pages/VerifyEmail/VerifyEmail";
import { Profile as LoginProfile } from "./features/authentication/pages/Profile/Profile";
import { AuthenticationContextProvider } from "./features/authentication/context/AuthenticationContextProvider";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { AuthenticationLayout } from "./features/authentication/components/Layout/AuthenticationLayout";
import { ApplicationLayout } from "./components/ApplicationLayout/ApplicationLayout";
import { Notifications } from "./features/feed/pages/Notifications/Notifications";
import { PostPage } from "./features/feed/pages/Post/Post";
import { Messaging } from "./features/messaging/pages/Messaging/Messaging";
import { Conversation } from "./features/messaging/pages/Conversation/Conversation";
import { Network } from "./features/networking/pages/Network/Network";
import { Connections } from "./features/networking/pages/Connections/Connections";
import { Invitations } from "./features/networking/pages/Invitations/Invitations";
import { Posts } from "./features/profile/pages/Posts/Posts";
import { Profile } from "./features/profile/pages/Profile/Profile";
import { CVUpload } from "./features/ai/pages/CVUpload/CVUpload";
import { Interview } from "./features/ai/pages/Interview/Interview";
import { InterviewHistory } from "./features/ai/pages/InterviewHistory/InterviewHistory";
import { RoleGuard } from "./features/authentication/components/RoleGuard/RoleGuard";
import { RagAdmin } from "./features/admin/pages/RagAdmin/RagAdmin";
import { AdminLayout } from "./features/admin/layout/AdminLayout";
import { AdminOverview } from "./features/admin/pages/AdminOverview/AdminOverview";
import { AdminUsers } from "./features/admin/pages/AdminUsers/AdminUsers";
import { AdminReports } from "./features/admin/pages/AdminReports/AdminReports";

// Jobs feature imports
import { JobList } from "./features/jobs/pages/JobList/JobList";
import { JobDetail } from "./features/jobs/pages/JobDetail/JobDetail";
import { JobForm } from "./features/jobs/pages/JobForm/JobForm";
import { RecruiterDashboard } from "./features/jobs/pages/RecruiterDashboard/RecruiterDashboard";
import { RecruiterApplications } from "./features/jobs/pages/RecruiterApplications/RecruiterApplications";
import { MyApplications } from "./features/jobs/pages/MyApplications/MyApplications";

// Companies feature imports
import { CompanyRegister } from "./features/companies/pages/CompanyRegister/CompanyRegister";
import { CompanyDetail } from "./features/companies/pages/CompanyDetail/CompanyDetail";
import { CompanyEdit } from "./features/companies/pages/CompanyEdit/CompanyEdit";

// Events feature imports
import { EventList } from "./features/events/pages/EventList/EventList";
import { EventDetail } from "./features/events/pages/EventDetail/EventDetail";
import { EventForm } from "./features/events/pages/EventForm/EventForm";

// Admin feature imports
import { CompanyAdmin } from "./features/admin/pages/CompanyAdmin/CompanyAdmin";

const router = createBrowserRouter([
  {
    element: <AuthenticationContextProvider />,
    children: [
      {
        path: "/",
        element: <ApplicationLayout />,
        children: [
          {
            index: true,
            element: <Feed />,
          },
          {
            path: "posts/:id",
            element: <PostPage />,
          },
          {
            path: "network",
            element: <Network />,
            children: [
              {
                index: true,
                element: <Navigate to="invitations" />,
              },
              {
                path: "invitations",
                element: <Invitations />,
              },
              {
                path: "connections",
                element: <Connections />,
              },
            ],
          },
          // Jobs Routes
          {
            path: "jobs",
            element: <JobList />,
          },
          {
            path: "jobs/:id",
            element: <JobDetail />,
          },
          {
            path: "jobs/new",
            element: (
              <RoleGuard allow={["RECRUITER"]}>
                <JobForm />
              </RoleGuard>
            ),
          },
          {
            path: "jobs/:id/edit",
            element: (
              <RoleGuard allow={["RECRUITER"]}>
                <JobForm />
              </RoleGuard>
            ),
          },
          {
            path: "jobs/recruiter",
            element: (
              <RoleGuard allow={["RECRUITER"]}>
                <RecruiterDashboard />
              </RoleGuard>
            ),
          },
          {
            path: "jobs/:id/applications",
            element: (
              <RoleGuard allow={["RECRUITER"]}>
                <RecruiterApplications />
              </RoleGuard>
            ),
          },
          {
            path: "jobs/my-applications",
            element: (
              <RoleGuard allow={["USER"]}>
                <MyApplications />
              </RoleGuard>
            ),
          },

          // Companies Routes
          {
            path: "companies/register",
            element: <CompanyRegister />,
          },
          {
            path: "companies/:slug",
            element: <CompanyDetail />,
          },
          {
            path: "companies/:id/edit",
            element: (
              <RoleGuard allow={["RECRUITER"]}>
                <CompanyEdit />
              </RoleGuard>
            ),
          },

          // Events Routes
          {
            path: "events",
            element: <EventList />,
          },
          {
            path: "events/:id",
            element: <EventDetail />,
          },
          {
            path: "events/new",
            element: (
              <RoleGuard allow={["RECRUITER"]}>
                <EventForm />
              </RoleGuard>
            ),
          },
          {
            path: "events/:id/edit",
            element: (
              <RoleGuard allow={["RECRUITER"]}>
                <EventForm />
              </RoleGuard>
            ),
          },

          // Unified Admin Routes
          {
            path: "admin",
            element: (
              <RoleGuard allow={["ADMIN"]}>
                <AdminLayout />
              </RoleGuard>
            ),
            children: [
              {
                path: "overview",
                element: <AdminOverview />,
              },
              {
                path: "users",
                element: <AdminUsers />,
              },
              {
                path: "reports",
                element: <AdminReports />,
              },
              {
                path: "companies",
                element: <CompanyAdmin />,
              },
              {
                path: "rag",
                element: <RagAdmin />,
              },
            ],
          },
          {
            path: "ai/cv",
            element: <CVUpload />,
          },
          {
            path: "ai/interview",
            element: <Interview />,
          },
          {
            path: "ai/interview/history",
            element: <InterviewHistory />,
          },

          {
            path: "messaging",
            element: <Messaging />,
            children: [
              {
                path: "conversations/:id",
                element: <Conversation />,
              },
            ],
          },
          {
            path: "notifications",
            element: <Notifications />,
          },
          {
            path: "profile/:id",
            element: <Profile />,
          },
          {
            path: "profile/:id/posts",
            element: <Posts />,
          },
        ],
      },
      {
        path: "/authentication",
        element: <AuthenticationLayout />,
        children: [
          {
            path: "login",
            element: <Login />,
          },
          {
            path: "signup",
            element: <Signup />,
          },
          {
            path: "request-password-reset",
            element: <ResetPassword />,
          },
          {
            path: "verify-email",
            element: <VerifyEmail />,
          },
          {
            path: "profile/:id",
            element: <LoginProfile />,
          },
        ],
      },
      {
        path: "*",
        element: <Navigate to="/" />,
      },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
    <ToastContainer />
  </StrictMode>
);
